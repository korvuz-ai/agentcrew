"""B8 — Company settings endpoints (budget cap, alert threshold)."""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.db.base import get_db
from app.db.models import Company
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["companies"])


class CompanyBudgetPatch(BaseModel):
    budget_cap_usd: float | None = None
    alert_threshold_pct: int | None = None


class CompanyOut(BaseModel):
    id: str
    name: str
    budget_cap_usd: float
    alert_threshold_pct: int


@router.get("/api/companies/{company_id}", response_model=CompanyOut)
async def get_company(company_id: UUID, db: AsyncSession = Depends(get_db)):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    return CompanyOut(
        id=str(company.id),
        name=company.name,
        budget_cap_usd=float(company.budget_cap_usd),
        alert_threshold_pct=company.alert_threshold_pct,
    )


@router.patch("/api/companies/{company_id}", response_model=CompanyOut)
async def patch_company(
    company_id: UUID,
    body: CompanyBudgetPatch,
    db: AsyncSession = Depends(get_db),
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")

    if body.budget_cap_usd is not None:
        company.budget_cap_usd = Decimal(str(round(body.budget_cap_usd, 4)))
    if body.alert_threshold_pct is not None:
        pct = max(0, min(100, body.alert_threshold_pct))
        company.alert_threshold_pct = pct

    await db.commit()
    await db.refresh(company)

    return CompanyOut(
        id=str(company.id),
        name=company.name,
        budget_cap_usd=float(company.budget_cap_usd),
        alert_threshold_pct=company.alert_threshold_pct,
    )
