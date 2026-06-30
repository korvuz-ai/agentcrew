"""B6 — File upload / download (MinIO-backed).

Upload: POST /api/companies/{company_id}/sessions/{session_id}/files
  - multipart/form-data, field name = "file"
  - stored at MinIO path: {company_id}/{session_id}/{filename}
  - returns FileOut with download_url pointing to the backend proxy

Download: GET /api/files/{object_path:path}
  - streams file bytes from MinIO through the backend
  - works behind nginx without exposing MinIO directly
"""
from __future__ import annotations

import asyncio
import re
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Path, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.storage.minio_client import delete_object, get_object, upload_bytes

router = APIRouter(tags=["files"])

_SAFE_NAME = re.compile(r"[^a-zA-Z0-9._\-]")


def _sanitize(filename: str) -> str:
    name = _SAFE_NAME.sub("_", filename or "upload")
    return name[:200]  # cap length


class FileOut(BaseModel):
    filename: str
    object_path: str   # MinIO key: {company_id}/{session_id}/{filename}
    download_url: str  # backend proxy URL: /api/files/{object_path}
    size_bytes: int
    content_type: str


@router.post(
    "/api/companies/{company_id}/sessions/{session_id}/files",
    response_model=FileOut,
    status_code=201,
    summary="Upload a file to a session",
)
async def upload_file(
    company_id: UUID = Path(...),
    session_id: UUID = Path(...),
    file: UploadFile = File(...),
):
    # TODO: auth — verify session belongs to company_id
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(400, "File is empty")
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(413, "File exceeds 50 MB limit")

    content_type = file.content_type or "application/octet-stream"
    safe_name = _sanitize(file.filename or "upload")
    object_path = f"{company_id}/{session_id}/{safe_name}"

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, upload_bytes, object_path, data, content_type)

    return FileOut(
        filename=safe_name,
        object_path=object_path,
        download_url=f"/api/files/{object_path}",
        size_bytes=len(data),
        content_type=content_type,
    )


@router.get(
    "/api/files/{object_path:path}",
    summary="Download / stream a file through the backend",
)
async def download_file(object_path: str = Path(...)):
    # TODO: auth — verify caller has access to the company in the object_path prefix
    try:
        loop = asyncio.get_event_loop()
        data, content_type = await loop.run_in_executor(None, get_object, object_path)
    except Exception:
        raise HTTPException(404, "File not found")

    filename = object_path.rsplit("/", 1)[-1]
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.delete(
    "/api/companies/{company_id}/sessions/{session_id}/files/{object_path:path}",
    status_code=204,
    summary="Delete a file",
)
async def delete_file(
    company_id: UUID = Path(...),
    session_id: UUID = Path(...),
    object_path: str = Path(...),
):
    # TODO: auth
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, delete_object, object_path)
    except Exception:
        raise HTTPException(404, "File not found")
