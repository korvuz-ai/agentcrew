// Purpose: Skill library page — catalog of reusable skill cards with create/edit/delete
// Used by: sidebar navigation

"use client"

import { useState } from "react"
import { useAgents, useSkills } from "@/lib/store"
import { SkillCard, NewSkillCard } from "@/components/skill-card/SkillCard"
import { SkillDialog } from "@/components/skill-card/SkillDialog"
import type { Skill } from "@/lib/types"

export default function LibraryPage() {
  const { skills, createSkill, updateSkill, deleteSkill } = useSkills()
  const { agents } = useAgents()
  const [editing, setEditing] = useState<Skill | null | undefined>(undefined)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Skill Library</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Reusable instructions you attach to agents — {skills.length} {skills.length === 1 ? "skill" : "skills"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            agents={agents}
            onClick={() => setEditing(skill)}
            onDelete={() => deleteSkill(skill.id)}
          />
        ))}
        <NewSkillCard onClick={() => setEditing(null)} />
      </div>

      {editing !== undefined && (
        <SkillDialog
          open
          skill={editing}
          onSave={(data) =>
            editing ? updateSkill(editing.id, data) : createSkill(data)
          }
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
