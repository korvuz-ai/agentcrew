"""B8 — Provider rate-limit fallback via Redis.

When a CrewAI run fails with a rate-limit error, the failing provider is
marked in Redis with a short TTL. pick_provider (agent_factory.py) checks
Redis before selecting; rate-limited providers are skipped.

TTL is intentionally short (60 s) — we want to retry providers quickly
rather than block them for a long time.
"""
from __future__ import annotations

import redis as redis_lib

from app.core.config import settings

_RATE_LIMIT_TTL = 60  # seconds

_RATE_LIMIT_SIGNALS = [
    "rate_limit",
    "ratelimit",
    "RateLimitError",
    "too many requests",
    "429",
    "quota",
    "resource_exhausted",
    "RESOURCE_EXHAUSTED",
    # Gemini/VertexAI overload (503)
    "503",
    "service_unavailable",
    "ServiceUnavailableError",
    "ServiceUnavailable",
    "UNAVAILABLE",
    "high demand",
    "currently experiencing",
    "try again later",
    # OpenAI / Anthropic overload
    "overloaded",
    "529",
]


def _client() -> redis_lib.Redis:
    return redis_lib.from_url(settings.REDIS_URL, decode_responses=True)


def _key(company_id: str, provider: str) -> str:
    return f"ratelimit:{company_id}:{provider}"


def is_rate_limit_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(signal.lower() in msg for signal in _RATE_LIMIT_SIGNALS)


def mark_rate_limited(company_id: str, provider: str) -> None:
    try:
        _client().setex(_key(company_id, provider), _RATE_LIMIT_TTL, "1")
    except Exception:
        pass  # Redis unavailable — degrade gracefully


def is_rate_limited(company_id: str, provider: str) -> bool:
    try:
        return bool(_client().exists(_key(company_id, provider)))
    except Exception:
        return False  # Redis unavailable — assume not rate-limited


def clear_rate_limit(company_id: str, provider: str) -> None:
    try:
        _client().delete(_key(company_id, provider))
    except Exception:
        pass
