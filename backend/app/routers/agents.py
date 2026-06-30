from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import Agent

router = APIRouter(prefix="/api/companies/{company_id}/agents", tags=["agents"])


class AgentIn(BaseModel):
    name: str
    role: str = ""
    backstory: str = ""
    avatar: str = ""
    manager_id: Optional[UUID] = None
    level: int = 1
    providers: list[str] = []
    skill_ids: list[str] = []
    system_prompt: str = ""
    cwd: Optional[str] = None


class AgentPatch(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    backstory: Optional[str] = None
    avatar: Optional[str] = None
    manager_id: Optional[UUID] = None
    level: Optional[int] = None
    providers: Optional[list[str]] = None
    skill_ids: Optional[list[str]] = None
    system_prompt: Optional[str] = None
    cwd: Optional[str] = None


class AgentOut(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    role: Optional[str]
    backstory: Optional[str]
    avatar: Optional[str]
    manager_id: Optional[UUID]
    level: int
    providers: list
    skill_ids: list
    system_prompt: Optional[str]
    cwd: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[AgentOut])
async def list_agents(company_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    result = await db.execute(select(Agent).where(Agent.company_id == company_id))
    return result.scalars().all()


@router.post("", response_model=AgentOut, status_code=201)
async def create_agent(company_id: UUID, data: AgentIn, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    agent = Agent(company_id=company_id, **data.model_dump())
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(company_id: UUID, agent_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    agent = await db.get(Agent, agent_id)
    if not agent or agent.company_id != company_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(
    company_id: UUID, agent_id: UUID, data: AgentPatch, db: AsyncSession = Depends(get_db)
):
    # TODO: auth
    agent = await db.get(Agent, agent_id)
    if not agent or agent.company_id != company_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(agent, k, v)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(company_id: UUID, agent_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    agent = await db.get(Agent, agent_id)
    if not agent or agent.company_id != company_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
    await db.commit()
