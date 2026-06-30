// Purpose: Office floor plan — agents grouped by department zone, live desk states from WS
// Used by: sidebar navigation

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAgents, useSessions } from "@/lib/store"
import { useSessionWS, type WSEvent } from "@/lib/useSessionWS"
import { AgentDesk, type DeskState } from "@/components/office/AgentDesk"
import type { Agent } from "@/lib/types"

// ── Fallback simulation (runs only when no real session is active) ───────────

const FALLBACK_MESSAGES = [
  "Analyzing the requirements...",
  "Coordinating with the team...",
  "Running through the data...",
  "Drafting the response...",
  "Reviewing for quality...",
  "Checking the details...",
  "Finalizing the output...",
  "Planning next steps...",
  "Summarizing findings...",
  "Syncing with stakeholders...",
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function stripMd(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\n+/g, " ")
    .trim()
}

type StateEntry = { state: DeskState; message?: string }
type StateMap = Record<string, StateEntry>

function nextState(
  current: DeskState,
  agentId: string,
  realMessages: Record<string, string>,
): StateEntry {
  switch (current) {
    case "idle": {
      const r = Math.random()
      if (r < 0.35) return { state: "thinking" }
      if (r < 0.50) return { state: "working" }
      return { state: "idle" }
    }
    case "thinking":
      return Math.random() < 0.65 ? { state: "working" } : { state: "idle" }
    case "working": {
      if (Math.random() < 0.55) {
        const msg = realMessages[agentId]
        return { state: "talking", message: msg ?? pick(FALLBACK_MESSAGES) }
      }
      return { state: "idle" }
    }
    case "talking":
      return { state: "idle" }
  }
}

// ── Zone layout from managerId hierarchy ────────────────────────────────────

const ZONE_STYLES = [
  { bg: "bg-violet-50 dark:bg-violet-950/20", border: "border-violet-200 dark:border-violet-800/40", label: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-800/40", label: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-rose-50 dark:bg-rose-950/20", border: "border-rose-200 dark:border-rose-800/40", label: "text-rose-700 dark:text-rose-300" },
]

function buildLayout(agents: Agent[]) {
  const ceo = agents.find(a => !a.managerId)
  if (!ceo) return { executive: [] as Agent[], zones: [] as { name: string; members: Agent[]; bg: string; border: string; label: string }[] }

  function subtree(headId: string): Agent[] {
    const directs = agents.filter(a => a.managerId === headId)
    return directs.flatMap(d => [d, ...subtree(d.id)])
  }

  const ceoDirects = agents.filter(a => a.managerId === ceo.id)
  const zones = ceoDirects.map((head, i) => ({
    name: head.role,
    members: subtree(head.id),
    ...ZONE_STYLES[i % ZONE_STYLES.length],
  })).filter(z => z.members.length > 0)

  return { executive: [ceo, ...ceoDirects], zones }
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function OfficePage() {
  const { agents } = useAgents()
  const { sessions } = useSessions()
  const router = useRouter()

  // Simulation state (fallback when no real session is running)
  const [simMap, setSimMap] = useState<StateMap>({})
  // WS-driven live states — override simulation when a real session is active
  const [wsMap, setWsMap] = useState<Record<string, StateEntry>>({})
  // Message content from recent agent outputs
  const realMsgRef = useRef<Record<string, string>>({})

  // Find the most recently running session to subscribe to
  const runningSession = [...sessions].reverse().find(s => s.status === "running")
  const wsSessionId = runningSession?.id ?? null
  const isWsActive = !!wsSessionId

  // Build agentId → latest real message from sessions
  useEffect(() => {
    const map: Record<string, string> = {}
    sessions.forEach(s => {
      ;[...s.messages].reverse().forEach(m => {
        if (m.role === "agent" && m.agentId && !map[m.agentId]) {
          const clean = stripMd(m.content)
          map[m.agentId] = clean.length > 90 ? clean.slice(0, 87) + "…" : clean
        }
      })
    })
    realMsgRef.current = map
  }, [sessions])

  // Init simulation when agents load
  useEffect(() => {
    if (agents.length === 0) return
    const init: StateMap = {}
    agents.forEach(a => { init[a.id] = { state: "idle" } })
    setSimMap(init)
  }, [agents])

  // Simulation tick (paused while a live session is running)
  useEffect(() => {
    if (agents.length === 0 || isWsActive) return
    const id = setInterval(() => {
      const agent = pick(agents)
      setSimMap(prev => ({
        ...prev,
        [agent.id]: nextState(prev[agent.id]?.state ?? "idle", agent.id, realMsgRef.current),
      }))
    }, 1800)
    return () => clearInterval(id)
  }, [agents, isWsActive])

  // ── WS event handler ─────────────────────────────────────────────────────────
  const handleWsEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case "agent_start":
        setWsMap(prev => ({ ...prev, [event.agent_id]: { state: "thinking" } }))
        break

      case "agent_thought":
        if (event.agent_id) {
          setWsMap(prev => ({ ...prev, [event.agent_id!]: { state: "working" } }))
        }
        break

      case "agent_done": {
        const snippet = event.output.length > 87
          ? event.output.slice(0, 87) + "…"
          : event.output
        setWsMap(prev => ({ ...prev, [event.agent_id]: { state: "talking", message: snippet } }))
        setTimeout(() => {
          setWsMap(prev => {
            const entry = prev[event.agent_id]
            if (entry?.state === "talking") return { ...prev, [event.agent_id]: { state: "idle" } }
            return prev
          })
        }, 4000)
        break
      }

      case "pipeline_done":
        setWsMap({})
        break
    }
  }, [])

  useSessionWS(wsSessionId, isWsActive, handleWsEvent)

  // Merge: WS states take priority over simulation
  const effectiveState = (agentId: string): StateEntry =>
    wsMap[agentId] ?? simMap[agentId] ?? { state: "idle" }

  const { executive, zones } = buildLayout(agents)

  const desk = (agent: Agent) => (
    <AgentDesk
      key={agent.id}
      agent={agent}
      state={effectiveState(agent.id).state}
      message={effectiveState(agent.id).message}
      onClick={() => router.push("/dashboard/chat")}
    />
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Office</h1>
          <p className="text-sm text-muted-foreground">
            {isWsActive
              ? "Live — pipeline is running"
              : "Simulated activity — click any desk to chat"}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          {isWsActive && (
            <span className="flex items-center gap-1.5 rounded-full bg-yellow-50 px-2.5 py-1 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
              Live
            </span>
          )}
          {[
            { color: "bg-neutral-300 dark:bg-neutral-600", label: "Idle" },
            { color: "bg-yellow-400", label: "Thinking" },
            { color: "bg-blue-500", label: "Working" },
            { color: "bg-green-500", label: "Responding" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* C-Suite row */}
      {executive.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
            C-Suite
          </p>
          <div className="flex flex-wrap gap-3">
            {executive.map(desk)}
          </div>
        </div>
      )}

      {/* Department zones */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {zones.map(zone => (
          <div key={zone.name} className={`rounded-xl border p-4 ${zone.bg} ${zone.border}`}>
            <p className={`mb-3 text-[10px] font-semibold uppercase tracking-widest ${zone.label}`}>
              {zone.name}
            </p>
            <div className="flex flex-wrap gap-3">
              {zone.members.map(desk)}
            </div>
          </div>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
          <p className="text-sm">No agents yet</p>
          <p className="text-xs opacity-60">Create agents from the Agents page first</p>
        </div>
      )}
    </div>
    </div>
  )
}
