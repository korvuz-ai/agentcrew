// Purpose: Org chart — top-down tree using managerId relationships, compact agent nodes
// Used by: sidebar navigation

"use client"

import Image from "next/image"
import { GitBranch } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAgents } from "@/lib/store"
import { LEVEL_COLOR, LEVEL_LABEL, PROVIDER_COLOR, PROVIDER_LABEL, type Agent } from "@/lib/types"

// ── node card ────────────────────────────────────────────────────────────────

function OrgNode({ agent }: { agent: Agent }) {
  const router = useRouter()
  const isImage = agent.avatar?.endsWith(".png") || agent.avatar?.endsWith(".jpg")

  return (
    <button
      onClick={() => router.push("/dashboard/agents")}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition hover:border-primary/40 hover:shadow-md w-[110px]"
    >
      {/* Avatar */}
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary/60 overflow-hidden select-none">
        {isImage ? (
          <Image src={`/agents/${agent.avatar}`} alt={agent.name} width={56} height={56} className="object-contain" />
        ) : (
          <span className="text-3xl leading-none">{agent.avatar}</span>
        )}
      </div>

      {/* Name + role */}
      <p className="text-[11px] font-semibold text-foreground text-center leading-tight line-clamp-1 w-full">{agent.name}</p>
      <p className="text-[10px] text-muted-foreground text-center leading-tight line-clamp-2 w-full">{agent.role}</p>

      {/* Level */}
      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${LEVEL_COLOR[agent.level]}`}>
        {LEVEL_LABEL[agent.level]}
      </span>

      {/* Providers */}
      <div className="flex flex-wrap justify-center gap-0.5">
        {agent.providers.map((p) => (
          <span key={p} className={`rounded border px-1 text-[8px] font-medium ${PROVIDER_COLOR[p]}`}>
            {PROVIDER_LABEL[p]}
          </span>
        ))}
      </div>
    </button>
  )
}

// ── tree renderer ─────────────────────────────────────────────────────────────

function OrgTree({ agent, allAgents }: { agent: Agent; allAgents: Agent[] }) {
  const children = allAgents.filter((a) => a.managerId === agent.id)
  const isOnly = children.length === 1

  return (
    <div className="flex flex-col items-center">
      <OrgNode agent={agent} />

      {children.length > 0 && (
        <>
          {/* Vertical stem from card to horizontal bar */}
          <div className="w-px h-6 bg-border" />

          {/* Children row */}
          <div className="flex items-start">
            {children.map((child, idx) => {
              const isFirst = idx === 0
              const isLast = idx === children.length - 1

              return (
                <div key={child.id} className="flex flex-col items-center">
                  {/* Horizontal connector segment */}
                  {!isOnly && (
                    <div className="relative flex w-full h-px">
                      {/* Left half of horizontal bar — all except first child */}
                      <div className={`flex-1 ${!isFirst ? "bg-border" : "bg-transparent"}`} />
                      {/* Right half — all except last child */}
                      <div className={`flex-1 ${!isLast ? "bg-border" : "bg-transparent"}`} />
                    </div>
                  )}

                  {/* Vertical connector down to child node */}
                  <div className="w-px h-6 bg-border" />

                  {/* Recurse */}
                  <div className="px-2">
                    <OrgTree agent={child} allAgents={allAgents} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const { agents } = useAgents()
  const router = useRouter()

  if (agents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <GitBranch className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No agents yet</p>
        <button
          onClick={() => router.push("/dashboard/agents")}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Go to Agents →
        </button>
      </div>
    )
  }

  // Roots = agents with no managerId or managerId not found in list
  const agentIds = new Set(agents.map((a) => a.id))
  const roots = agents.filter((a) => !a.managerId || !agentIds.has(a.managerId))

  return (
    <div className="overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Org Chart</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {agents.length} agents — set &quot;Reports to&quot; on each agent to build the hierarchy
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/agents")}
          className="text-xs text-primary hover:underline"
        >
          Edit agents →
        </button>
      </div>

      {/* Tree — scrollable horizontally */}
      <div className="min-w-max py-4 px-8">
        {roots.length === 1 ? (
          <OrgTree agent={roots[0]} allAgents={agents} />
        ) : (
          <div className="flex gap-12 items-start">
            {roots.map((root) => (
              <OrgTree key={root.id} agent={root} allAgents={agents} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
