from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import Skill

router = APIRouter(prefix="/api/companies/{company_id}/skills", tags=["skills"])


class SkillIn(BaseModel):
    name: str
    description: str = ""
    category: str = ""
    content: str = ""  # frontend field "instructions" maps here


class SkillPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None


class SkillOut(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    description: Optional[str]
    category: Optional[str]
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[SkillOut])
async def list_skills(company_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    result = await db.execute(select(Skill).where(Skill.company_id == company_id))
    return result.scalars().all()


@router.post("", response_model=SkillOut, status_code=201)
async def create_skill(company_id: UUID, data: SkillIn, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    skill = Skill(company_id=company_id, **data.model_dump())
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill


@router.get("/{skill_id}", response_model=SkillOut)
async def get_skill(company_id: UUID, skill_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    skill = await db.get(Skill, skill_id)
    if not skill or skill.company_id != company_id:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.patch("/{skill_id}", response_model=SkillOut)
async def update_skill(
    company_id: UUID, skill_id: UUID, data: SkillPatch, db: AsyncSession = Depends(get_db)
):
    # TODO: auth
    skill = await db.get(Skill, skill_id)
    if not skill or skill.company_id != company_id:
        raise HTTPException(status_code=404, detail="Skill not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(skill, k, v)
    await db.commit()
    await db.refresh(skill)
    return skill


@router.delete("/{skill_id}", status_code=204)
async def delete_skill(company_id: UUID, skill_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    skill = await db.get(Skill, skill_id)
    if not skill or skill.company_id != company_id:
        raise HTTPException(status_code=404, detail="Skill not found")
    await db.delete(skill)
    await db.commit()
