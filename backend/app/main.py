import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.crews.pipeline_runner import setup_litellm_callbacks
from app.db.base import AsyncSessionLocal
from app.routers import agents, api_keys, companies, files, pipelines, runs, sessions, skills, webhooks
from app.storage.minio_client import ensure_bucket
from app.ws.manager import manager as ws_manager
from app.ws.router import router as ws_router

app = FastAPI(
    title="AgentCrew API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(webhooks.router)
app.include_router(companies.router)
app.include_router(agents.router)
app.include_router(skills.router)
app.include_router(pipelines.router)
app.include_router(sessions.router)
app.include_router(runs.router)
app.include_router(files.router)
app.include_router(api_keys.router)
app.include_router(ws_router)


@app.on_event("startup")
async def startup():
    ws_manager.set_loop(asyncio.get_event_loop())
    setup_litellm_callbacks()
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, ensure_bucket)


@app.get("/api/health", tags=["infra"])
async def health():
    db_status = "unknown"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_status = "ok"
    except Exception:
        db_status = "error"
    return {"status": "ok", "version": "0.1.0", "env": settings.APP_ENV, "db": db_status}
