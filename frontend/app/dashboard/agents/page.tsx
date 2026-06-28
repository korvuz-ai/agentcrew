// Purpose: Agent management page — grid of agent cards with create/edit/delete
// Used by: sidebar navigation, dashboard/page.tsx redirect

"use client"

import { useState } from "react"
import { useAgents, useSkills } from "@/lib/store"
import { AgentCard, NewAgentCard } from "@/components/agent-card/AgentCard"
import { AgentDialog } from "@/components/agent-card/AgentDialog"
import type { Agent } from "@/lib/types"

export default function AgentsPage() {
  const { agents, createAgent, updateAgent, deleteAgent } = useAgents()
  const { skills } = useSkills()
  const [editing, setEditing] = useState<Agent | null | undefined>(undefined)
  // undefined = dialog closed, null = create mode, Agent = edit mode

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Agents</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your AI workforce — {agents.length} {agents.length === 1 ? "agent" : "agents"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
          onSave={(data) =>
            editing ? updateAgent(editing.id, data) : createAgent(data)
          }
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
