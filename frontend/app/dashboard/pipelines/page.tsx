// Purpose: Pipeline list page — grid of pipeline cards with create/edit/delete
// Used by: sidebar navigation

"use client"

import { useState } from "react"
import { useAgents, usePipelines } from "@/lib/store"
import { PipelineCard, NewPipelineCard } from "@/components/pipeline/PipelineCard"
import { PipelineDialog } from "@/components/pipeline/PipelineDialog"
import type { Pipeline } from "@/lib/types"

export default function PipelinesPage() {
  const { pipelines, createPipeline, updatePipeline, deletePipeline } = usePipelines()
  const { agents } = useAgents()
  const [editing, setEditing] = useState<Pipeline | null | undefined>(undefined)

  return (
    <div className="flex-1 overflow-y-auto p-6">
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pipelines</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pipelines.length === 0
              ? "No pipelines yet — create one to start running your agents"
              : `${pipelines.length} pipeline${pipelines.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          + New pipeline
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {pipelines.map((p) => (
          <PipelineCard
            key={p.id}
            pipeline={p}
            agents={agents}
            onClick={() => setEditing(p)}
            onDelete={() => deletePipeline(p.id)}
          />
        ))}
        <NewPipelineCard onClick={() => setEditing(null)} />
      </div>

      {editing !== undefined && (
        <PipelineDialog
          open
          pipeline={editing}
          agents={agents}
          onSave={(data) =>
            editing ? updatePipeline(editing.id, data) : createPipeline(data)
          }
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
    </div>
  )
}
