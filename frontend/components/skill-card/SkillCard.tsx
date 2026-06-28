// Purpose: Single skill tile — name, description, category chip, usage count
// Used by: app/dashboard/library/page.tsx

import { BookOpen, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Skill, Agent } from "@/lib/types"

interface Props {
  skill: Skill
  agents: Agent[]
  onClick: () => void
  onDelete: () => void
}

export function SkillCard({ skill, agents, onClick, onDelete }: Props) {
  const usedBy = agents.filter((a) => a.skillIds.includes(skill.id)).length

  return (
    <div
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute right-3 top-3 hidden rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{skill.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {skill.category ? (
          <Badge variant="secondary" className="text-[10px]">{skill.category}</Badge>
        ) : <span />}
        <span className="text-[10px] text-muted-foreground/60">
          {usedBy} {usedBy === 1 ? "agent" : "agents"}
        </span>
      </div>
    </div>
  )
}

export function NewSkillCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/50 p-6 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
    >
      <BookOpen className="mb-2 h-7 w-7" />
      <span className="text-sm font-medium">New Skill</span>
    </button>
  )
}
