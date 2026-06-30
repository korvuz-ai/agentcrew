"""B8 — Budget cap utilities.

Monthly spend is summed from usage_events (source of truth).
Returns (allowed, spend_this_month, cap). Cap = 0 means unlimited.
"""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def get_monthly_spend(db: AsyncSession, company_id: UUID) -> Decimal:
    """Sum cost_usd for this company in the current calendar month."""
    from app.db.models import Session as DbSession, UsageEvent  # avoid circular

    result = await db.execute(
        select(func.coalesce(func.sum(UsageEvent.cost_usd), 0))
        .join(DbSession, UsageEvent.session_id == DbSession.id)
        .where(
            DbSession.company_id == company_id,
            func.date_trunc("month", UsageEvent.created_at)
            == func.date_trunc("month", func.now()),
        )
    )
    return Decimal(str(result.scalar() or 0))


async def check_budget(
    db: AsyncSession, company_id: UUID
) -> tuple[bool, Decimal, Decimal]:
    """Return (allowed, spend, cap). allowed=True if cap=0 (unlimited) or spend < cap."""
    from app.db.models import Company

    company = await db.get(Company, company_id)
    cap = Decimal(str(company.budget_cap_usd)) if company else Decimal("0")
    if cap <= 0:
        return True, Decimal("0"), cap  # unlimited

    spend = await get_monthly_spend(db, company_id)
    return spend < cap, spend, cap


async def maybe_emit_budget_alert(
    db: AsyncSession,
    company_id: UUID,
    session_id: str,
    new_cost: Decimal,
) -> None:
    """Emit budget_alert WS event if post-run spend crosses alert threshold."""
    from app.db.models import Company
    from app.ws.manager import manager as ws_manager

    company = await db.get(Company, company_id)
    if not company:
        return
    cap = Decimal(str(company.budget_cap_usd))
    if cap <= 0:
        return  # unlimited — nothing to alert

    spend = await get_monthly_spend(db, company_id)
    threshold = cap * Decimal(str(company.alert_threshold_pct)) / Decimal("100")
    if spend >= threshold:
        pct_used = int(spend / cap * 100)
        await ws_manager.broadcast(session_id, {
            "type": "budget_alert",
            "session_id": session_id,
            "spend_usd": float(spend),
            "cap_usd": float(cap),
            "pct_used": pct_used,
            "threshold_pct": company.alert_threshold_pct,
        })
