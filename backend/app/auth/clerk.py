"""Clerk JWT verification and current-company dependency."""
from __future__ import annotations

import httpx
from jose import JWTError, ExpiredSignatureError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.base import get_db
from app.db.models import Company

_security = HTTPBearer()
_jwks_cache: dict = {}


async def _fetch_jwks() -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            settings.CLERK_JWKS_URL,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()


async def _get_public_key(kid: str) -> dict:
    global _jwks_cache
    if not _jwks_cache:
        _jwks_cache = await _fetch_jwks()

    for key in _jwks_cache.get("keys", []):
        if key.get("kid") == kid:
            return key

    # Refresh once on kid miss (key rotation)
    _jwks_cache = await _fetch_jwks()
    for key in _jwks_cache.get("keys", []):
        if key.get("kid") == kid:
            return key

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown signing key")


async def get_current_company(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    db: AsyncSession = Depends(get_db),
) -> Company:
    """Verify Clerk JWT and return the matching Company row."""
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid", "")
        public_key = await _get_public_key(kid)
        payload = jwt.decode(token, public_key, algorithms=["RS256"])
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Clerk session tokens carry org_id when an org is active
    org_id: str | None = payload.get("org_id")
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token has no active organization",
        )

    result = await db.execute(select(Company).where(Company.clerk_org_id == org_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not synced yet")

    return company
