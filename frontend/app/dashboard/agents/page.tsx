// Purpose: Agent management page — grid of agent cards with create/edit/delete + demo seed loader
// Used by: sidebar navigation, dashboard/page.tsx redirect

"use client"

import { useState } from "react"
import { Bot, Sparkles } from "lucide-react"
import { useAgents, useSkills } from "@/lib/store"
import { AgentCard, NewAgentCard } from "@/components/agent-card/AgentCard"
import { AgentDialog } from "@/components/agent-card/AgentDialog"
import { buildDemoTeam } from "@/lib/seeds"
import type { Agent } from "@/lib/types"

export default function AgentsPage() {
  const { agents, createAgent, updateAgent, deleteAgent, loadSeeds } = useAgents()
  const { skills } = useSkills()
  const [editing, setEditing] = useState<Agent | null | undefined>(undefined)

  function handleLoadDemo() {
    const { agents: demoAgents, skills: demoSkills } = buildDemoTeam()
    loadSeeds(demoAgents, demoSkills)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Agents</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your AI workforce — {agents.length} {agents.length === 1 ? "agent" : "agents"}
          </p>
        </div>
        {agents.length > 0 && (
          <button
            onClick={() => setEditing(null)}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            + New agent
          </button>
        )}
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary">
            <Bot className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">No agents yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Create your first agent or load the demo team to get started.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Create agent
            </button>
            <button
              onClick={handleLoadDemo}
              className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Load demo team
            </button>
          </div>
        </div>
      ) : (
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
      )}

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
