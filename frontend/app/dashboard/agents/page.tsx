// Purpose: Agent management page — grid of agent cards with create/edit/delete
// Used by: sidebar navigation, dashboard/page.tsx redirect

"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { useAgents, useSkills } from "@/lib/store"
import { AgentCard, NewAgentCard } from "@/components/agent-card/AgentCard"
import { AgentDialog } from "@/components/agent-card/AgentDialog"
import type { Agent } from "@/lib/types"

export default function AgentsPage() {
  const { agents, createAgent, updateAgent, deleteAgent, resetToDemo } = useAgents()
  const { skills } = useSkills()
  const [editing, setEditing] = useState<Agent | null | undefined>(undefined)

  return (
    <div className="flex-1 overflow-y-auto p-6">
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Agents</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your AI workforce — {agents.length} {agents.length === 1 ? "agent" : "agents"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetToDemo}
            title="Reset to demo team"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset demo
          </button>
          <button
            onClick={() => setEditing(null)}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            + New agent
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            skills={skills}
            onClick={() => setEditing(agent)}
            onDelete={() => deleteAgent(agent.id)}
          />
        ))}
        <NewAgentCard onClick={() => setEditing(null)} />
      </div>

      {editing !== undefined && (
        <AgentDialog
          open
          agent={editing}
          skills={skills}
          allAgents={agents}
          onSave={(data) =>
            editing ? updateAgent(editing.id, data) : createAgent(data)
          }
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
    </div>
  )
}
