"""B7 — ApiKeyVault CRUD + connection test.

Keys are Fernet-encrypted at rest. Frontend only ever sees has_key + updated_at,
never the plaintext or ciphertext.

Endpoints:
  GET  /api/companies/{id}/api-keys/{provider}       — has_key + updated_at
  PUT  /api/companies/{id}/api-keys/{provider}       — encrypt + upsert
  DELETE /api/companies/{id}/api-keys/{provider}     — remove
  GET  /api/companies/{id}/api-keys/{provider}/test  — decrypt → litellm test call
"""
from __future__ import annotations

import asyncio
import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt, encrypt
from app.db.base import get_db
from app.db.models import ApiKeyVault

router = APIRouter(
    prefix="/api/companies/{company_id}/api-keys",
    tags=["api-keys"],
)

SUPPORTED = {"claude", "gemini", "gpt"}

# Cheapest/fastest model per provider — used only for connection test
_TEST_MODEL = {
    "claude": "claude-haiku-4-5-20251001",
    "gemini": "gemini/gemini-3.1-flash-lite",
    "gpt":    "openai/gpt-5.5-instant",
}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class KeyIn(BaseModel):
    key: str

class KeyOut(BaseModel):
    provider: str
    has_key: bool
    updated_at: str | None = None

class TestOut(BaseModel):
    ok: bool
    latency_ms: int | None = None
    error: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_row(db: AsyncSession, company_id: UUID, provider: str) -> ApiKeyVault | None:
    return (await db.execute(
        select(ApiKeyVault).where(
            ApiKeyVault.company_id == company_id,
            ApiKeyVault.provider == provider,
        )
    )).scalar_one_or_none()


def _check_provider(provider: str) -> None:
    if provider not in SUPPORTED:
        raise HTTPException(400, f"Unsupported provider '{provider}'. Must be one of: {sorted(SUPPORTED)}")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{provider}", response_model=KeyOut)
async def get_api_key(
    company_id: UUID = Path(...),
    provider: str = Path(...),
    db: AsyncSession = Depends(get_db),
):
    # TODO: auth
    _check_provider(provider)
    row = await _get_row(db, company_id, provider)
    return KeyOut(
        provider=provider,
        has_key=row is not None,
        updated_at=row.updated_at.isoformat() if row else None,
    )


@router.put("/{provider}", response_model=KeyOut)
async def put_api_key(
    body: KeyIn,
    company_id: UUID = Path(...),
    provider: str = Path(...),
    db: AsyncSession = Depends(get_db),
):
    # TODO: auth
    _check_provider(provider)
    key = body.key.strip()
    if not key:
        raise HTTPException(400, "key must not be empty")

    try:
        encrypted = encrypt(key)
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    row = await _get_row(db, company_id, provider)
    if row:
        row.encrypted_key = encrypted
    else:
        row = ApiKeyVault(
            company_id=company_id,
            provider=provider,
            encrypted_key=encrypted,
        )
        db.add(row)

    await db.commit()
    await db.refresh(row)
    return KeyOut(
        provider=provider,
        has_key=True,
        updated_at=row.updated_at.isoformat(),
    )


@router.delete("/{provider}", status_code=204)
async def delete_api_key(
    company_id: UUID = Path(...),
    provider: str = Path(...),
    db: AsyncSession = Depends(get_db),
):
    # TODO: auth
    _check_provider(provider)
    row = await _get_row(db, company_id, provider)
    if row:
        await db.delete(row)
        await db.commit()


@router.get("/{provider}/test", response_model=TestOut)
async def test_api_key(
    company_id: UUID = Path(...),
    provider: str = Path(...),
    db: AsyncSession = Depends(get_db),
):
    # TODO: auth
    _check_provider(provider)
    row = await _get_row(db, company_id, provider)
    if not row:
        raise HTTPException(404, f"No API key stored for provider '{provider}'")

    try:
        plain_key = decrypt(row.encrypted_key)
    except ValueError as e:
        return TestOut(ok=False, error=str(e))

    model = _TEST_MODEL.get(provider, "claude-haiku-4-5-20251001")

    def _test() -> tuple[bool, int, str | None]:
        import litellm  # noqa: PLC0415  (import inside thread)
        t0 = time.monotonic()
        try:
            litellm.completion(
                model=model,
                messages=[{"role": "user", "content": "Reply with the single word OK."}],
                max_tokens=5,
                api_key=plain_key,
            )
            return True, int((time.monotonic() - t0) * 1000), None
        except Exception as exc:
            return False, 0, str(exc)[:300]

    loop = asyncio.get_event_loop()
    ok, latency_ms, error = await loop.run_in_executor(None, _test)
    return TestOut(ok=ok, latency_ms=latency_ms if ok else None, error=error)
