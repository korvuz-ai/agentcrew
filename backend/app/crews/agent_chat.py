"""B3 — Single-agent chat: call LLM directly (no CrewAI) for session-scoped chat."""
from __future__ import annotations

import time
from decimal import Decimal
from uuid import UUID

import litellm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crews.agent_factory import pick_provider
from app.db.base import AsyncSessionLocal
from app.db.models import Agent, ApiKeyVault, LevelModelMap, Message, Session as DbSession, Skill
from app.ws.manager import manager as ws_manager


async def execute_agent_chat(
    company_id: UUID,
    session_id: UUID,
    agent_id: UUID,
    preferred_provider: str | None = None,
) -> None:
    """Background task: call LLM and persist agent response for a single-agent session."""
    async with AsyncSessionLocal() as db:
        try:
            await _chat(db, company_id, session_id, agent_id, preferred_provider)
        except Exception as exc:
            try:
                await _save_error(db, session_id, agent_id, str(exc))
            except Exception:
                pass


async def _chat(
    db: AsyncSession,
    company_id: UUID,
    session_id: UUID,
    agent_id: UUID,
    preferred_provider: str | None = None,
) -> None:
    agent = await db.get(Agent, agent_id)
    if not agent:
        await _save_error(db, session_id, agent_id, "Agent not found")
        return

    lmm_rows = (await db.execute(select(LevelModelMap))).scalars().all()
    level_map: dict[tuple[int, str], str] = {(r.level, r.provider): r.model_id for r in lmm_rows}

    vault_keys: dict[str, str] = {}
    try:
        from app.core.encryption import decrypt  # noqa: PLC0415
        akv_rows = (await db.execute(
            select(ApiKeyVault).where(ApiKeyVault.company_id == company_id)
        )).scalars().all()
        for akv in akv_rows:
            try:
                vault_keys[akv.provider] = decrypt(akv.encrypted_key)
            except Exception:
                pass
    except RuntimeError:
        pass  # no FERNET_MASTER_KEY — fall back to env vars

    provider = pick_provider(
        agent.providers or ["claude"],
        vault_keys,
        str(company_id),
        preferred=preferred_provider,
    )
    model_id = level_map.get((agent.level, provider), "claude-sonnet-4-6")
    api_key = vault_keys.get(provider)

    skills_content = ""
    if agent.skill_ids:
        skill_uuids = [UUID(sid) for sid in (agent.skill_ids or []) if _valid_uuid(sid)]
        if skill_uuids:
            s_rows = (await db.execute(
                select(Skill).where(Skill.id.in_(skill_uuids))
            )).scalars().all()
            skills_content = "\n\n".join(f"### {s.name}\n{s.content}" for s in s_rows)

    backstory = (agent.backstory or "").strip()
    if skills_content:
        backstory = f"{backstory}\n\nCapabilities & Skills:\n{skills_content}".strip()
    system_prompt = (
        f"You are {agent.name}, {agent.role}.\n{backstory}"
        if backstory
        else f"You are {agent.name}, a skilled {agent.role or 'professional'}."
    )

    # Build conversation history from DB (includes user message saved before this task)
    history_rows = (await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )).scalars().all()

    llm_messages = [{"role": "system", "content": system_prompt}]
    for msg in history_rows:
        role = "user" if msg.role == "user" else "assistant"
        llm_messages.append({"role": role, "content": msg.content})

    sid_str = str(session_id)
    aid_str = str(agent_id)
    await ws_manager.broadcast(sid_str, {
        "type": "agent_start",
        "session_id": sid_str,
        "agent_id": aid_str,
    })

    start_time = time.time()
    response_content = ""
    tokens_in = 0
    tokens_out = 0
    cost_usd = Decimal("0")

    try:
        call_kwargs: dict = {"model": model_id, "messages": llm_messages}
        if api_key:
            call_kwargs["api_key"] = api_key
        response = await litellm.acompletion(**call_kwargs)
        response_content = response.choices[0].message.content or ""
        usage = getattr(response, "usage", None)
        if usage:
            tokens_in = getattr(usage, "prompt_tokens", 0)
            tokens_out = getattr(usage, "completion_tokens", 0)
        try:
            cost_usd = Decimal(str(round(litellm.completion_cost(completion_response=response), 6)))
        except Exception:
            pass
    except Exception as exc:
        response_content = f"[Agent error: {exc}]"

    latency_ms = int((time.time() - start_time) * 1000)

    ai_msg = Message(
        session_id=session_id,
        role="agent",
        content=response_content,
        agent_id=agent_id,
        tokens_in=tokens_in,
        cost_usd=cost_usd,
        latency_ms=latency_ms,
    )
    db.add(ai_msg)

    session_obj = await db.get(DbSession, session_id)
    if session_obj:
        session_obj.total_cost_usd = (session_obj.total_cost_usd or Decimal("0")) + cost_usd

    await db.commit()

    await ws_manager.broadcast(sid_str, {
        "type": "agent_done",
        "session_id": sid_str,
        "agent_id": aid_str,
        "output": response_content,
        "cost_usd": float(cost_usd),
        "latency_ms": latency_ms,
        "tokens": tokens_in + tokens_out,
    })


def _valid_uuid(s: str) -> bool:
    try:
        UUID(s)
        return True
    except ValueError:
        return False


async def _save_error(db: AsyncSession, session_id: UUID, agent_id: UUID, reason: str) -> None:
    db.add(Message(
        session_id=session_id,
        role="agent",
        content=f"[Chat error: {reason}]",
        agent_id=agent_id,
    ))
    await db.commit()
