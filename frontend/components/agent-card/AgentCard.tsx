// Purpose: Displays a single agent as a trading-card style tile with level, providers, skills
// Used by: app/dashboard/agents/page.tsx

import Image from "next/image"
import { Bot, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  LEVEL_COLOR, LEVEL_LABEL, LEVEL_MODELS,
  PROVIDER_COLOR, PROVIDER_LABEL,
  type Agent, type Skill,
} from "@/lib/types"

function AgentAvatar({ avatar, size = 64 }: { avatar: string; size?: number }) {
  const isImage = avatar.endsWith(".png") || avatar.endsWith(".jpg") || avatar.endsWith(".webp")
  if (isImage) {
    return (
      <Image
        src={`/agents/${avatar}`}
        alt={avatar}
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    )
  }
  if (avatar) {
    return <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{avatar}</span>
  }
  return <Bot style={{ width: size * 0.5, height: size * 0.5 }} className="text-muted-foreground" />
}

interface Props {
  agent: Agent
  skills: Skill[]
  onClick: () => void
  onDelete: () => void
}

export function AgentCard({ agent, skills, onClick, onDelete }: Props) {
  const agentSkills = skills.filter((s) => agent.skillIds.includes(s.id))

  return (
    <div
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute right-3 top-3 hidden rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Avatar */}
      <div className="mb-3 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-secondary/60 select-none overflow-hidden">
          <AgentAvatar avatar={agent.avatar} size={80} />
        </div>
      </div>

      {/* Name + role */}
      <p className="truncate text-center text-sm font-semibold text-foreground">{agent.name}</p>
      <p className="mb-3 truncate text-center text-xs text-muted-foreground">{agent.role}</p>

      {/* Level badge */}
      <div className="mb-2 flex justify-center">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${LEVEL_COLOR[agent.level]}`}>
          Lv.{agent.level} {LEVEL_LABEL[agent.level]}
        </span>
      </div>

      {/* Providers */}
      <div className="mb-2 flex flex-wrap justify-center gap-1">
        {agent.providers.map((p) => (
          <span key={p} className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${PROVIDER_COLOR[p]}`}>
            {PROVIDER_LABEL[p]}
          </span>
        ))}
      </div>

      {/* Model names */}
      <div className="mb-3 text-center">
        {agent.providers.map((p) => (
          <p key={p} className="text-[10px] text-muted-foreground/60">
            {PROVIDER_LABEL[p]}: {LEVEL_MODELS[agent.level][p]}
          </p>
        ))}
      </div>

      {/* Skills */}
      {agentSkills.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-border pt-2">
          {agentSkills.slice(0, 3).map((s) => (
            <Badge key={s.id} variant="secondary" className="text-[10px]">
              {s.name}
            </Badge>
          ))}
          {agentSkills.length > 3 && (
            <Badge variant="secondary" className="text-[10px]">
              +{agentSkills.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

export function NewAgentCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/50 p-4 text-muted-foreground transition hover:border-primary/40 hover:text-foreground min-h-[220px]"
    >
      <Plus className="mb-2 h-8 w-8" />
      <span className="text-sm font-medium">New Agent</span>
    </button>
  )
}
