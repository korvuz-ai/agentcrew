// Purpose: Org chart page — shows agents as hierarchy nodes (flat in Phase 2, hierarchy from Phase 3 pipelines)
// Used by: sidebar navigation

"use client"

import { Bot, GitBranch } from "lucide-react"
import { useAgents } from "@/lib/store"
import { LEVEL_COLOR, LEVEL_LABEL, PROVIDER_COLOR, PROVIDER_LABEL } from "@/lib/types"
import { useRouter } from "next/navigation"

export default function OrgChartPage() {
  const { agents } = useAgents()
  const router = useRouter()

  if (agents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <GitBranch className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No agents yet</p>
        <p className="text-xs text-muted-foreground/60">
          Create agents first, then build a Pipeline to see the org chart hierarchy.
        </p>
        <button
          onClick={() => router.push("/dashboard/agents")}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Go to Agents →
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Org Chart</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Agent hierarchy — connect agents via Pipelines (Phase 3) to see orchestrator/worker relationships
        </p>
      </div>

      {/* Phase 2: flat grid view — hierarchy auto-derives from pipelines in Phase 3 */}
      <div className="flex flex-wrap gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => router.push("/dashboard/agents")}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md w-36"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
              <Bot className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-foreground truncate w-full">{agent.name}</p>
              <p className="text-[10px] text-muted-foreground truncate w-full">{agent.role}</p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${LEVEL_COLOR[agent.level]}`}>
              Lv.{agent.level} {LEVEL_LABEL[agent.level]}
            </span>
            <div className="flex flex-wrap justify-center gap-1">
              {agent.providers.map((p) => (
                <span key={p} className={`rounded border px-1 py-0.5 text-[9px] font-medium ${PROVIDER_COLOR[p]}`}>
                  {PROVIDER_LABEL[p]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground/50">
        Hierarchy lines will appear automatically once you create a Pipeline with Orchestrator + Workers.
      </p>
    </div>
  )
}
