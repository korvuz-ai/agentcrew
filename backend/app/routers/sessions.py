from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.base import get_db
from app.db.models import Message, Session

router = APIRouter(prefix="/api/companies/{company_id}/sessions", tags=["sessions"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SessionIn(BaseModel):
    name: str
    pipeline_id: Optional[UUID] = None
    agent_id: Optional[UUID] = None
    status: str = "running"


class SessionPatch(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    total_cost_usd: Optional[Decimal] = None


class MessageIn(BaseModel):
    role: str
    content: str
    agent_id: Optional[UUID] = None
    thinking: Optional[str] = None
    tokens_in: int = 0
    cost_usd: Decimal = Decimal("0")
    latency_ms: int = 0


class MessageOut(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    agent_id: Optional[UUID]
    thinking: Optional[str]
    tokens_in: int
    cost_usd: Decimal
    latency_ms: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    pipeline_id: Optional[UUID]
    agent_id: Optional[UUID]
    status: str
    total_cost_usd: Decimal
    messages: list[MessageOut]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Sessions ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[SessionOut])
async def list_sessions(company_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    result = await db.execute(
        select(Session)
        .where(Session.company_id == company_id)
        .options(selectinload(Session.messages))
        .order_by(Session.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=SessionOut, status_code=201)
async def create_session(company_id: UUID, data: SessionIn, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    session = Session(company_id=company_id, **data.model_dump())
    db.add(session)
    await db.commit()
    await db.refresh(session)
    result = await db.execute(
        select(Session).where(Session.id == session.id).options(selectinload(Session.messages))
    )
    return result.scalar_one()


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(company_id: UUID, session_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    result = await db.execute(
        select(Session)
        .where(Session.id == session_id, Session.company_id == company_id)
        .options(selectinload(Session.messages))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/{session_id}", response_model=SessionOut)
async def update_session(
    company_id: UUID, session_id: UUID, data: SessionPatch, db: AsyncSession = Depends(get_db)
):
    # TODO: auth
    result = await db.execute(
        select(Session)
        .where(Session.id == session_id, Session.company_id == company_id)
        .options(selectinload(Session.messages))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(session, k, v)
    await db.commit()
    result = await db.execute(
        select(Session).where(Session.id == session_id).options(selectinload(Session.messages))
    )
    return result.scalar_one()


class ChatIn(BaseModel):
    content: str
    preferred_provider: Optional[str] = None


@router.post("/{session_id}/chat", status_code=202)
async def chat_with_agent(
    company_id: UUID,
    session_id: UUID,
    data: ChatIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """B3 — Single-agent chat: save user message, kick off LLM call in background."""
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.company_id == company_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.agent_id:
        raise HTTPException(status_code=400, detail="Not a single-agent session")

    # Persist user message now so history is correct when background task reads it
    db.add(Message(session_id=session_id, role="user", content=data.content))
    await db.commit()

    from app.crews.agent_chat import execute_agent_chat  # noqa: PLC0415
    background_tasks.add_task(
        execute_agent_chat,
        company_id=company_id,
        session_id=session_id,
        agent_id=session.agent_id,
        preferred_provider=data.preferred_provider,
    )
    return {"status": "accepted"}


@router.delete("/{session_id}", status_code=204)
async def delete_session(company_id: UUID, session_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    session = await db.get(Session, session_id)
    if not session or session.company_id != company_id:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()


# ── Messages ──────────────────────────────────────────────────────────────────

@router.get("/{session_id}/messages", response_model=list[MessageOut])
async def list_messages(company_id: UUID, session_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    session = await db.get(Session, session_id)
    if not session or session.company_id != company_id:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    return result.scalars().all()


@router.post("/{session_id}/messages", response_model=MessageOut, status_code=201)
async def append_message(
    company_id: UUID, session_id: UUID, data: MessageIn, db: AsyncSession = Depends(get_db)
):
    # TODO: auth
    session = await db.get(Session, session_id)
    if not session or session.company_id != company_id:
        raise HTTPException(status_code=404, detail="Session not found")

    message = Message(session_id=session_id, **data.model_dump())
    db.add(message)

    # update running total on the session
    session.total_cost_usd = (session.total_cost_usd or Decimal("0")) + data.cost_usd

    await db.commit()
    await db.refresh(message)
    return message
