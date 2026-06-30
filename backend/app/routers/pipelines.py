from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.base import get_db
from app.db.models import Pipeline, PipelineNode

router = APIRouter(prefix="/api/companies/{company_id}/pipelines", tags=["pipelines"])


class NodeIn(BaseModel):
    agent_id: UUID
    condition: Optional[str] = None


class PipelineIn(BaseModel):
    name: str
    description: str = ""
    process_type: str = "sequential"
    orchestrator_id: Optional[UUID] = None
    cwd: Optional[str] = None
    nodes: list[NodeIn] = []


class PipelinePatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    process_type: Optional[str] = None
    orchestrator_id: Optional[UUID] = None
    cwd: Optional[str] = None
    nodes: Optional[list[NodeIn]] = None  # if provided, replaces all existing nodes


class NodeOut(BaseModel):
    id: UUID
    pipeline_id: UUID
    agent_id: UUID
    order_index: int
    condition: Optional[str]

    model_config = {"from_attributes": True}


class PipelineOut(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    description: Optional[str]
    process_type: str
    orchestrator_id: Optional[UUID]
    cwd: Optional[str]
    nodes: list[NodeOut]
    created_at: datetime

    model_config = {"from_attributes": True}


def _pipeline_query(company_id: UUID):
    return (
        select(Pipeline)
        .where(Pipeline.company_id == company_id)
        .options(selectinload(Pipeline.nodes))
    )


@router.get("", response_model=list[PipelineOut])
async def list_pipelines(company_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    result = await db.execute(_pipeline_query(company_id))
    return result.scalars().all()


@router.post("", response_model=PipelineOut, status_code=201)
async def create_pipeline(company_id: UUID, data: PipelineIn, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    pipeline = Pipeline(
        company_id=company_id,
        name=data.name,
        description=data.description,
        process_type=data.process_type,
        orchestrator_id=data.orchestrator_id,
        cwd=data.cwd,
    )
    db.add(pipeline)
    await db.flush()  # get pipeline.id before inserting nodes

    for i, node in enumerate(data.nodes):
        db.add(PipelineNode(
            pipeline_id=pipeline.id,
            agent_id=node.agent_id,
            order_index=i,
            condition=node.condition,
        ))

    await db.commit()
    await db.refresh(pipeline)
    # reload with nodes
    result = await db.execute(
        select(Pipeline).where(Pipeline.id == pipeline.id).options(selectinload(Pipeline.nodes))
    )
    return result.scalar_one()


@router.get("/{pipeline_id}", response_model=PipelineOut)
async def get_pipeline(company_id: UUID, pipeline_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    result = await db.execute(
        select(Pipeline)
        .where(Pipeline.id == pipeline_id, Pipeline.company_id == company_id)
        .options(selectinload(Pipeline.nodes))
    )
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.patch("/{pipeline_id}", response_model=PipelineOut)
async def update_pipeline(
    company_id: UUID, pipeline_id: UUID, data: PipelinePatch, db: AsyncSession = Depends(get_db)
):
    # TODO: auth
    result = await db.execute(
        select(Pipeline)
        .where(Pipeline.id == pipeline_id, Pipeline.company_id == company_id)
        .options(selectinload(Pipeline.nodes))
    )
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    for k, v in data.model_dump(exclude_unset=True, exclude={"nodes"}).items():
        setattr(pipeline, k, v)

    if data.nodes is not None:
        await db.execute(delete(PipelineNode).where(PipelineNode.pipeline_id == pipeline_id))
        for i, node in enumerate(data.nodes):
            db.add(PipelineNode(
                pipeline_id=pipeline.id,
                agent_id=node.agent_id,
                order_index=i,
                condition=node.condition,
            ))

    await db.commit()
    result = await db.execute(
        select(Pipeline).where(Pipeline.id == pipeline_id).options(selectinload(Pipeline.nodes))
    )
    return result.scalar_one()


@router.delete("/{pipeline_id}", status_code=204)
async def delete_pipeline(company_id: UUID, pipeline_id: UUID, db: AsyncSession = Depends(get_db)):
    # TODO: auth
    pipeline = await db.get(Pipeline, pipeline_id)
    if not pipeline or pipeline.company_id != company_id:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    await db.delete(pipeline)
    await db.commit()
