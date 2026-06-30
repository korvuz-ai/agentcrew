// Purpose: Agent desk card for the office floor plan — avatar, name, role, animated state
// Used by: app/dashboard/office/page.tsx

"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import type { Agent } from "@/lib/types"

export type DeskState = "idle" | "thinking" | "working" | "talking"

interface Props {
  agent: Agent
  state: DeskState
  message?: string
  onClick?: () => void
}

const RING: Record<DeskState, string> = {
  idle:     "ring-transparent",
  thinking: "ring-yellow-400",
  working:  "ring-blue-500",
  talking:  "ring-green-500",
}

const DOT: Record<DeskState, string> = {
  idle:     "bg-neutral-300 dark:bg-neutral-600",
  thinking: "bg-yellow-400 animate-pulse",
  working:  "bg-blue-500",
  talking:  "bg-green-500",
}

const LABEL: Record<DeskState, string> = {
  idle:     "Idle",
  thinking: "Thinking",
  working:  "Working",
  talking:  "Responding",
}

export function AgentDesk({ agent, state, message, onClick }: Props) {
  const isImage = agent.avatar.endsWith(".png") || agent.avatar.endsWith(".jpg")

  return (
    <button
      onClick={onClick}
      className="group relative flex w-36 flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      {/* Speech bubble — visible only when talking */}
      {state === "talking" && message && (
        <div className="absolute -top-14 left-1/2 z-10 w-44 -translate-x-1/2 rounded-lg bg-foreground px-2.5 py-1.5 text-[10px] leading-snug text-background shadow-lg">
          {message}
          <div className="absolute -bottom-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-foreground" />
        </div>
      )}

      {/* Avatar + state ring */}
      <div className="relative">
        {/* Ping animation for working state */}
        {state === "working" && (
          <div className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping" />
        )}

        <div className={cn(
          "h-14 w-14 overflow-hidden rounded-full bg-muted ring-2 transition-all duration-300",
          RING[state],
          state === "thinking" && "animate-pulse",
        )}>
          {isImage ? (
            <Image
              src={`/agents/${agent.avatar}`}
              alt={agent.name}
              width={56}
              height={56}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl">
              {agent.avatar}
            </span>
          )}
        </div>
      </div>

      {/* Name + role */}
      <div className="w-full min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">{agent.name}</p>
        <p className="truncate text-[10px] leading-tight text-muted-foreground">{agent.role}</p>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT[state])} />
        <span className="text-[10px] text-muted-foreground">{LABEL[state]}</span>
      </div>
    </button>
  )
}
