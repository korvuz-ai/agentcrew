from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.crews.pipeline_runner import execute_pipeline_run
from app.db.base import get_db
from app.db.models import Message, Pipeline
from app.db.models import Session as DbSession

router = APIRouter(prefix="/api/companies/{company_id}/pipelines", tags=["runs"])


class RunIn(BaseModel):
    task: str  # the user's prompt / task description
    provider: Optional[str] = None  # force a specific provider (claude/gemini/gpt); auto if None


class RunOut(BaseModel):
    session_id: str
    status: str = "started"


@router.post("/{pipeline_id}/run", response_model=RunOut, status_code=202)
async def run_pipeline(
    company_id: UUID,
    pipeline_id: UUID,
    data: RunIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Start a pipeline run. Creates a Session immediately and returns its ID.
    The CrewAI execution happens in a background task.
    """
    # TODO: auth
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline or pipeline.company_id != company_id:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    # Create session record
    session = DbSession(
        company_id=company_id,
        name=f"{pipeline.name} — {data.task[:60]}",
        pipeline_id=pipeline_id,
        status="running",
    )
    db.add(session)
    await db.flush()  # get session.id

    # Store user's task as first message
    db.add(Message(
        session_id=session.id,
        role="user",
        content=data.task,
    ))
    await db.commit()
    await db.refresh(session)

    # Kick off background CrewAI run
    background_tasks.add_task(
        execute_pipeline_run,
        company_id=company_id,
        pipeline_id=pipeline_id,
        session_id=session.id,
        task_description=data.task,
        preferred_provider=data.provider,
    )

    return RunOut(session_id=str(session.id))
