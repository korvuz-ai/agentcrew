"""Clerk webhook handler — syncs Clerk organizations → companies table."""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from app.core.config import settings
from app.db.base import get_db
from app.db.models import Company

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/clerk")
async def clerk_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    # Raw bytes required — svix verifies the exact payload bytes
    body = await request.body()
    headers = dict(request.headers)

    try:
        wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
        event = wh.verify(body, headers)
    except WebhookVerificationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    event_type: str = event.get("type", "")
    data: dict = event.get("data", {})

    if event_type in ("organization.created", "organization.updated"):
        await _upsert_company(db, data)
    elif event_type == "organization.deleted":
        await _delete_company(db, data)

    return {"received": True}


async def _upsert_company(db: AsyncSession, data: dict) -> None:
    clerk_org_id: str = data["id"]
    name: str = data.get("name", "")
    owner_clerk_id: str = data.get("created_by", "")

    stmt = (
        pg_insert(Company)
        .values(
            id=uuid4(),
            clerk_org_id=clerk_org_id,
            name=name,
            owner_clerk_id=owner_clerk_id,
        )
        .on_conflict_do_update(
            index_elements=["clerk_org_id"],
            set_={"name": name},
        )
    )
    await db.execute(stmt)
    await db.commit()


async def _delete_company(db: AsyncSession, data: dict) -> None:
    clerk_org_id: str = data["id"]
    result = await db.execute(select(Company).where(Company.clerk_org_id == clerk_org_id))
    company = result.scalar_one_or_none()
    if company:
        await db.delete(company)
        await db.commit()
