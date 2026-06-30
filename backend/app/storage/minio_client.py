"""B6 — MinIO S3 client wrapper.

Synchronous MinIO SDK calls are run in a thread executor from async FastAPI routes.
"""
from __future__ import annotations

import io
from minio import Minio
from minio.error import S3Error

from app.core.config import settings

_client: Minio | None = None


def _get() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
    return _client


def ensure_bucket() -> None:
    """Create the default bucket if it doesn't exist. Called at startup."""
    c = _get()
    bucket = settings.MINIO_BUCKET
    try:
        if not c.bucket_exists(bucket):
            c.make_bucket(bucket)
    except S3Error:
        pass


def upload_bytes(object_path: str, data: bytes, content_type: str) -> None:
    _get().put_object(
        settings.MINIO_BUCKET,
        object_path,
        io.BytesIO(data),
        len(data),
        content_type=content_type,
    )


def get_object(object_path: str) -> tuple[bytes, str]:
    """Returns (data_bytes, content_type)."""
    response = _get().get_object(settings.MINIO_BUCKET, object_path)
    try:
        data = response.read()
        ct = response.headers.get("content-type", "application/octet-stream")
    finally:
        response.close()
        response.release_conn()
    return data, ct


def delete_object(object_path: str) -> None:
    _get().remove_object(settings.MINIO_BUCKET, object_path)
