// Purpose: Pipeline card tile for the pipelines list page
// Used by: app/dashboard/pipelines/page.tsx

import { ArrowRight, Plus, Trash2, Users } from "lucide-react"
import type { Agent, Pipeline } from "@/lib/types"

interface Props {
  pipeline: Pipeline
  agents: Agent[]
  onClick: () => void
  onDelete: () => void
}

export function PipelineCard({ pipeline, agents, onClick, onDelete }: Props) {
  const isOW = pipeline.type === "orchestrator-worker"
  const orchestrator = agents.find((a) => a.id === pipeline.orchestratorId)
  const filledNodes = pipeline.nodes.filter((n) => n.agentId)
  const agentCount = isOW
    ? (orchestrator ? 1 : 0) + filledNodes.length
    : filledNodes.length

  return (
    <div
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute right-3 top-3 hidden rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/60">
        {isOW
          ? <Users className="h-5 w-5 text-muted-foreground" />
          : <ArrowRight className="h-5 w-5 text-muted-foreground" />}
      </div>

      <p className="truncate text-sm font-semibold text-foreground">{pipeline.name}</p>
      {pipeline.description && (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{pipeline.description}</p>
      )}

      <div className="mt-3">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
          isOW
            ? "border-violet-200 bg-violet-50 text-violet-700"
            : "border-blue-200 bg-blue-50 text-blue-700"
        }`}>
          {isOW ? "Orchestrator-Worker" : "Sequential"}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {agentCount} agent{agentCount !== 1 ? "s" : ""}
      </p>

      {isOW && orchestrator && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground/60">
          Orchestrator: {orchestrator.name}
        </p>
      )}

      {!isOW && filledNodes.length > 0 && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground/60">
          {filledNodes.slice(0, 3).map((n, i) => {
            const a = agents.find((ag) => ag.id === n.agentId)
            return a ? `${i > 0 ? " → " : ""}${a.name}` : ""
          }).join("")}
          {filledNodes.length > 3 ? ` +${filledNodes.length - 3}` : ""}
        </p>
      )}
    </div>
  )
}

export function NewPipelineCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/50 p-4 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
    >
      <Plus className="mb-1.5 h-7 w-7" />
      <span className="text-sm font-medium">New Pipeline</span>
    </button>
  )
}
