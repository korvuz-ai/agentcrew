"""B4 — CrewAI pipeline runner.

Runs in a FastAPI BackgroundTask:
  1. Load pipeline + agents + skills + level_model_map from DB (async)
  2. Build CrewAgent objects
  3. Run crew synchronously in a thread-pool executor
  4. Write output Message + UsageEvents to DB (async)
  5. Update session status

LiteLLM usage is captured via thread-local callbacks so concurrent runs
don't mix up their usage counters.
"""
from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

import litellm
from crewai import Crew, Process, Task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.budget import check_budget, maybe_emit_budget_alert
from app.crews.agent_factory import build_crew_agent, pick_provider
from app.crews.tools import make_cwd_tools
from app.crews.fallback import is_rate_limit_error, mark_rate_limited
from app.db.base import AsyncSessionLocal
from app.db.models import (
    Agent,
    LevelModelMap,
    Message,
    Pipeline,
    Session as DbSession,
    Skill,
    UsageEvent,
)
from app.ws.manager import manager as ws_manager

# ── LiteLLM usage collection ──────────────────────────────────────────────────

_thread_local = threading.local()


def _litellm_usage_handler(kwargs, completion_response, start_time, end_time):
    collector: list | None = getattr(_thread_local, "collector", None)
    if collector is None:
        return
    usage = getattr(completion_response, "usage", None)
    if not usage:
        return
    try:
        cost = litellm.completion_cost(completion_response=completion_response)
    except Exception:
        cost = 0.0
    collector.append({
        "model":       kwargs.get("model", ""),
        "tokens_in":   getattr(usage, "prompt_tokens", 0),
        "tokens_out":  getattr(usage, "completion_tokens", 0),
        "cost_usd":    float(cost),
        "latency_ms":  int((end_time - start_time).total_seconds() * 1000),
    })


def setup_litellm_callbacks() -> None:
    """Called once at app startup."""
    if _litellm_usage_handler not in litellm.success_callback:
        litellm.success_callback.append(_litellm_usage_handler)


# ── Sync crew execution (runs inside ThreadPoolExecutor) ──────────────────────

@dataclass
class RunSpec:
    process_type: str
    orchestrator_agent: object | None
    worker_agents: list
    task_description: str
    worker_meta: list[dict] = field(default_factory=list)
    # [{agent_id: UUID, provider: str, model_id: str}, ...]
    session_id: str = ""
    company_id: str = ""
    vault_keys: dict[str, str] = field(default_factory=dict)  # {provider: plaintext_key}
    # Stored for fallback rebuild (agents detach from DB session but attrs still readable)
    raw_worker_agents: list = field(default_factory=list)   # DB Agent rows
    raw_worker_skills: list[str] = field(default_factory=list)  # skills_content per worker
    level_map: dict = field(default_factory=dict)


def _emit(session_id: str, event: dict) -> None:
    """Broadcast WS event from background thread. No-op if session_id empty."""
    if session_id:
        ws_manager.broadcast_from_thread(session_id, event)


def _make_step_cb(session_id: str):
    """CrewAI step callback — emits agent_thought events."""
    def cb(step_output):
        try:
            content = (
                getattr(step_output, "log", None)
                or getattr(step_output, "thought", None)
                or str(step_output)
            )
            _emit(session_id, {
                "type": "agent_thought",
                "session_id": session_id,
                "content": str(content)[:400],
            })
        except Exception:
            pass
    return cb


def _make_task_cb(session_id: str, agent_id: str, outputs_collector: list):
    """CrewAI task callback — emits agent_done and collects per-agent output for DB persist."""
    def cb(task_output):
        try:
            output = getattr(task_output, "raw", None) or str(task_output)
            outputs_collector.append({"agent_id": agent_id, "output": str(output)})
            _emit(session_id, {
                "type": "agent_done",
                "session_id": session_id,
                "agent_id": agent_id,
                "output": str(output)[:3000],
            })
        except Exception:
            pass
    return cb


def _build_crew(spec: RunSpec, outputs_collector: list) -> object:
    """Build a Crew from spec (called once per attempt)."""
    sid = spec.session_id
    if spec.process_type == "sequential":
        tasks = []
        for i, ca in enumerate(spec.worker_agents):
            if i == 0:
                desc = spec.task_description
            else:
                desc = (
                    f"Original task: {spec.task_description}\n\n"
                    f"You are step {i + 1} of {len(spec.worker_agents)} in this pipeline. "
                    f"The previous agent has already worked on this. "
                    f"Build on their output and complete your part of the task."
                )
            agent_id = str(spec.worker_meta[i]["agent_id"]) if i < len(spec.worker_meta) else ""
            task_kwargs: dict = dict(
                description=desc,
                agent=ca,
                expected_output="A clear, complete response.",
                callback=_make_task_cb(sid, agent_id, outputs_collector),
            )
            # Pass previous task as context so CrewAI injects the actual output automatically
            if tasks:
                task_kwargs["context"] = [tasks[-1]]
            tasks.append(Task(**task_kwargs))
        return Crew(
            agents=spec.worker_agents,
            tasks=tasks,
            process=Process.sequential,
            verbose=True,
            step_callback=_make_step_cb(sid),
        )

    # orchestrator-worker / hierarchical
    orch_id = ""
    if spec.orchestrator_agent and spec.worker_meta:
        orch_id = str(spec.worker_meta[0]["agent_id"])
    task = Task(
        description=spec.task_description,
        expected_output="A comprehensive, complete response.",
        callback=_make_task_cb(sid, orch_id, outputs_collector),
    )
    all_agents = (
        [spec.orchestrator_agent] + spec.worker_agents
        if spec.orchestrator_agent
        else spec.worker_agents
    )
    crew_kwargs: dict = dict(
        agents=all_agents,
        tasks=[task],
        process=Process.hierarchical,
        verbose=True,
        step_callback=_make_step_cb(sid),
    )
    if spec.orchestrator_agent:
        crew_kwargs["manager_agent"] = spec.orchestrator_agent
    return Crew(**crew_kwargs)


def _friendly_error(exc: Exception) -> str:
    msg = str(exc)
    if "503" in msg or "ServiceUnavailable" in msg or "high demand" in msg or "UNAVAILABLE" in msg:
        return "Provider ไม่พร้อมใช้งาน (503 — high demand) กรุณาลองใหม่หรือเพิ่ม API key provider อื่น"
    if "429" in msg or "quota" in msg or "rate" in msg.lower() or "RESOURCE_EXHAUSTED" in msg:
        return "Rate limit เกิน (429) กรุณาลองใหม่ภายหลังหรือเปลี่ยน provider"
    if "401" in msg or "invalid" in msg.lower() and "key" in msg.lower():
        return "API key ไม่ถูกต้อง กรุณาตรวจสอบที่ Settings"
    return msg[:300]


def _rebuild_workers(spec: RunSpec, skip: set[str]) -> tuple[list, list[dict]]:
    """Rebuild CrewAI agents for workers using a different provider (for fallback)."""
    from app.crews.agent_factory import build_crew_agent  # noqa: PLC0415
    new_agents = []
    new_meta = []
    for i, db_agent in enumerate(spec.raw_worker_agents):
        provider = pick_provider(
            db_agent.providers or ["claude"],
            spec.vault_keys,
            spec.company_id,
            skip_providers=skip,
        )
        model_id = spec.level_map.get((db_agent.level, provider), "claude-sonnet-4-6")
        skills = spec.raw_worker_skills[i] if i < len(spec.raw_worker_skills) else ""
        api_key = spec.vault_keys.get(provider)
        ca = build_crew_agent(db_agent, model_id, skills, False, api_key)
        new_agents.append(ca)
        new_meta.append({
            "agent_id": spec.worker_meta[i]["agent_id"],
            "provider": provider,
            "model_id": model_id,
        })
    return new_agents, new_meta


def _run_crew_sync(spec: RunSpec) -> tuple[bool, str, list[dict]]:
    """Synchronous crew execution with provider fallback.

    On retryable error (rate-limit, 503 overload): mark the failing provider,
    rebuild crew agents with the next available provider, retry up to 3 times.
    """
    _thread_local.collector = []
    output = ""
    success = False
    sid = spec.session_id
    cid = spec.company_id

    for meta in spec.worker_meta:
        _emit(sid, {
            "type": "agent_start",
            "session_id": sid,
            "agent_id": str(meta["agent_id"]),
        })

    tried_providers: set[str] = set()
    current_spec = spec
    max_attempts = 3  # try up to 3 different providers
    agent_outputs: list[dict] = []  # per-agent outputs collected by task callbacks

    for attempt in range(max_attempts):
        agent_outputs.clear()
        try:
            crew = _build_crew(current_spec, agent_outputs)
            result = crew.kickoff()
            output = result.raw if hasattr(result, "raw") else str(result)
            success = True
            break

        except Exception as exc:
            if not is_rate_limit_error(exc):
                output = f"[Pipeline run failed: {_friendly_error(exc)}]"
                success = False
                break

            # Mark the failing provider
            failed_providers = {m["provider"] for m in current_spec.worker_meta}
            for p in failed_providers:
                tried_providers.add(p)
                if cid:
                    mark_rate_limited(cid, p)

            _emit(sid, {
                "type": "agent_thought",
                "session_id": sid,
                "content": f"[{', '.join(failed_providers)} ไม่พร้อม — กำลังลอง provider สำรอง…]",
            })

            if attempt >= max_attempts - 1:
                output = f"[Pipeline run failed: {_friendly_error(exc)}]"
                success = False
                break

            # Rebuild agents with fallback provider (uses raw DB agent data stored in spec)
            if spec.raw_worker_agents:
                try:
                    new_workers, new_meta = _rebuild_workers(current_spec, tried_providers)
                    current_spec = RunSpec(
                        process_type=spec.process_type,
                        orchestrator_agent=spec.orchestrator_agent,
                        worker_agents=new_workers,
                        task_description=spec.task_description,
                        worker_meta=new_meta,
                        session_id=sid,
                        company_id=cid,
                        vault_keys=spec.vault_keys,
                        raw_worker_agents=spec.raw_worker_agents,
                        raw_worker_skills=spec.raw_worker_skills,
                        level_map=spec.level_map,
                    )
                except Exception:
                    output = f"[Pipeline run failed: {_friendly_error(exc)}]"
                    success = False
                    break
            else:
                output = f"[Pipeline run failed: {_friendly_error(exc)}]"
                success = False
                break

    events: list[dict] = list(getattr(_thread_local, "collector", []))
    if hasattr(_thread_local, "collector"):
        del _thread_local.collector

    return success, output, events, agent_outputs


# ── Async orchestrator (FastAPI background task entry point) ──────────────────

async def execute_pipeline_run(
    company_id: UUID,
    pipeline_id: UUID,
    session_id: UUID,
    task_description: str,
    preferred_provider: str | None = None,
) -> None:
    """Background task: build crew, run it, persist results."""
    async with AsyncSessionLocal() as db:
        try:
            await _run(db, company_id, pipeline_id, session_id, task_description, preferred_provider)
        except Exception as exc:
            try:
                await _mark_failed(db, session_id, str(exc))
            except Exception:
                pass  # DB itself may be down — nothing we can do


async def _run(
    db: AsyncSession,
    company_id: UUID,
    pipeline_id: UUID,
    session_id: UUID,
    task_description: str,
    preferred_provider: str | None = None,
) -> None:
    # 1. Load pipeline with nodes
    p_result = await db.execute(
        select(Pipeline)
        .where(Pipeline.id == pipeline_id)
        .options(selectinload(Pipeline.nodes))
    )
    pipeline = p_result.scalar_one_or_none()
    if not pipeline:
        await _mark_failed(db, session_id, "Pipeline not found")
        return

    # 2. Load level → model map
    lmm_rows = (await db.execute(select(LevelModelMap))).scalars().all()
    level_map: dict[tuple[int, str], str] = {
        (row.level, row.provider): row.model_id for row in lmm_rows
    }

    # 3. Collect agent IDs needed
    node_agent_ids: list[UUID] = [node.agent_id for node in pipeline.nodes]
    ids_needed: set[UUID] = set(node_agent_ids)
    if pipeline.orchestrator_id:
        ids_needed.add(pipeline.orchestrator_id)

    agents_rows = (
        await db.execute(select(Agent).where(Agent.id.in_(ids_needed)))
    ).scalars().all()
    agents_by_id: dict[UUID, Agent] = {a.id: a for a in agents_rows}

    # 4. Load skills referenced by any agent
    all_skill_ids: set[str] = set()
    for a in agents_by_id.values():
        all_skill_ids.update(a.skill_ids or [])

    skills_by_id: dict[str, Skill] = {}
    if all_skill_ids:
        skill_uuids = []
        for sid in all_skill_ids:
            try:
                skill_uuids.append(UUID(sid))
            except ValueError:
                pass
        if skill_uuids:
            s_rows = (await db.execute(select(Skill).where(Skill.id.in_(skill_uuids)))).scalars()
            skills_by_id = {str(s.id): s for s in s_rows}

    # 5. Load API keys from vault (decrypt; fall back to env vars if vault has nothing)
    vault_keys: dict[str, str] = {}
    try:
        from app.core.encryption import decrypt  # noqa: PLC0415
        from app.db.models import ApiKeyVault as _AKV  # noqa: PLC0415
        akv_rows = (await db.execute(
            select(_AKV).where(_AKV.company_id == company_id)
        )).scalars().all()
        for akv in akv_rows:
            try:
                vault_keys[akv.provider] = decrypt(akv.encrypted_key)
            except Exception:
                pass  # skip if key cannot be decrypted (master key changed?)
    except RuntimeError:
        pass  # FERNET_MASTER_KEY not set — fall back to env vars only

    # 5b. Pre-run budget check — fail fast if company is over cap
    budget_allowed, budget_spend, budget_cap = await check_budget(db, company_id)
    if not budget_allowed:
        await _mark_failed(
            db,
            session_id,
            f"Budget cap exceeded (${float(budget_spend):.4f} spent of ${float(budget_cap):.2f} cap this month)",
        )
        return

    # 6. Build CrewAgent objects (with filesystem tools if pipeline has cwd)
    cwd_tools = make_cwd_tools(pipeline.cwd) if pipeline.cwd else []

    def _make(db_agent: Agent, delegation: bool = False):
        provider = pick_provider(db_agent.providers or [], vault_keys, str(company_id), preferred=preferred_provider)
        model_id = level_map.get((db_agent.level, provider), "claude-sonnet-4-6")
        skills_content = "\n\n".join(
            f"### {skills_by_id[sid].name}\n{skills_by_id[sid].content}"
            for sid in (db_agent.skill_ids or [])
            if sid in skills_by_id
        )
        api_key = vault_keys.get(provider)
        ca = build_crew_agent(db_agent, model_id, skills_content, delegation, api_key, cwd_tools or None)
        return ca, provider, model_id

    orchestrator_ca = None
    if pipeline.orchestrator_id and pipeline.orchestrator_id in agents_by_id:
        orchestrator_ca, _, _ = _make(agents_by_id[pipeline.orchestrator_id], delegation=True)

    worker_cas: list = []
    worker_meta: list[dict] = []
    raw_worker_agents: list = []
    raw_worker_skills: list[str] = []
    for node in pipeline.nodes:
        if node.agent_id in agents_by_id:
            db_agent = agents_by_id[node.agent_id]
            ca, prov, mid = _make(db_agent)
            worker_cas.append(ca)
            worker_meta.append({"agent_id": node.agent_id, "provider": prov, "model_id": mid})
            raw_worker_agents.append(db_agent)
            # Pre-compute skills content for this agent (for fallback rebuild)
            skills_content = "\n\n".join(
                f"### {skills_by_id[sid].name}\n{skills_by_id[sid].content}"
                for sid in (db_agent.skill_ids or [])
                if sid in skills_by_id
            )
            raw_worker_skills.append(skills_content)

    if not worker_cas and not orchestrator_ca:
        await _mark_failed(db, session_id, "No agents with valid API keys found")
        return

    # 7. Build RunSpec and execute
    spec = RunSpec(
        process_type=pipeline.process_type,
        orchestrator_agent=orchestrator_ca,
        worker_agents=worker_cas,
        task_description=task_description,
        worker_meta=worker_meta,
        session_id=str(session_id),
        company_id=str(company_id),
        vault_keys=vault_keys,
        raw_worker_agents=raw_worker_agents,
        raw_worker_skills=raw_worker_skills,
        level_map=level_map,
    )

    # 6. Run crew in thread pool (sync, blocking)
    loop = asyncio.get_event_loop()
    success, output, usage_events, agent_outputs = await loop.run_in_executor(None, _run_crew_sync, spec)

    # 7. Persist output + usage
    session_obj = await db.get(DbSession, session_id)
    if not session_obj:
        return

    # Save each agent's output as a separate message (so all icons show in UI)
    if agent_outputs:
        for ao in agent_outputs:
            try:
                aid = UUID(ao["agent_id"]) if ao.get("agent_id") else None
            except (ValueError, AttributeError):
                aid = None
            db.add(Message(
                session_id=session_id,
                role="agent",
                content=ao["output"],
                agent_id=aid,
            ))
    else:
        # Fallback: save single final output attributed to first agent
        first_agent_id = node_agent_ids[0] if node_agent_ids else None
        db.add(Message(
            session_id=session_id,
            role="agent",
            content=output,
            agent_id=first_agent_id,
        ))

    total_cost = Decimal("0")
    if success:
        for i, evt in enumerate(usage_events):
            cost = Decimal(str(round(evt["cost_usd"], 6)))
            total_cost += cost
            meta = worker_meta[i % len(worker_meta)] if worker_meta else None
            if meta:
                db.add(UsageEvent(
                    session_id=session_id,
                    agent_id=meta["agent_id"],
                    tokens_in=evt["tokens_in"],
                    tokens_out=evt["tokens_out"],
                    cost_usd=cost,
                    latency_ms=evt["latency_ms"],
                    provider=meta["provider"],
                    model=evt["model"] or meta["model_id"],
                ))

    session_obj.status = "completed" if success else "failed"
    session_obj.total_cost_usd = total_cost
    await db.commit()

    # Broadcast pipeline completion to any listening WebSocket clients
    await ws_manager.broadcast(str(session_id), {
        "type": "pipeline_done",
        "session_id": str(session_id),
        "status": session_obj.status,
        "total_cost_usd": float(total_cost),
    })

    # Emit budget_alert if spending crossed the alert threshold
    if success:
        await maybe_emit_budget_alert(db, company_id, str(session_id), total_cost)


async def _mark_failed(db: AsyncSession, session_id: UUID, reason: str) -> None:
    session_obj = await db.get(DbSession, session_id)
    if session_obj:
        session_obj.status = "failed"
        db.add(Message(
            session_id=session_id,
            role="agent",
            content=f"[Run failed: {reason}]",
        ))
        await db.commit()
