"""B7 — Fernet symmetric encryption for ApiKeyVault.

Master key stored in FERNET_MASTER_KEY env var.
Generate a new key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    key = settings.FERNET_MASTER_KEY.strip()
    if not key:
        raise RuntimeError(
            "FERNET_MASTER_KEY is not set — ApiKeyVault encryption unavailable. "
            "Generate one: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode())


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise ValueError("Decryption failed — FERNET_MASTER_KEY may have changed") from e
