// Purpose: Create / edit skill dialog with markdown editor for instructions
// Used by: app/dashboard/library/page.tsx

"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Skill } from "@/lib/types"

interface Props {
  open: boolean
  skill?: Skill | null
  onSave: (data: Omit<Skill, "id" | "createdAt">) => void
  onClose: () => void
}

const EMPTY = (): Omit<Skill, "id" | "createdAt"> => ({
  name: "",
  description: "",
  category: "",
  instructions: "",
})

export function SkillDialog({ open, skill, onSave, onClose }: Props) {
  const [form, setForm] = useState(EMPTY())
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    setForm(skill ? { ...skill } : EMPTY())
    setPreview(false)
  }, [skill, open])

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSave() {
    if (!form.name.trim()) return
    onSave(form)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{skill ? "Edit Skill" : "New Skill"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Web Search"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="e.g. Research"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Short description</Label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="One-line summary of what this skill does"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Instructions (markdown)</Label>
              <button
                type="button"
                onClick={() => setPreview((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {preview ? "Edit" : "Preview"}
              </button>
            </div>
            {preview ? (
              <div
                className="min-h-[140px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: mdToHtml(form.instructions) }}
              />
            ) : (
              <Textarea
                rows={7}
                className="font-mono text-xs"
                value={form.instructions}
                onChange={(e) => set("instructions", e.target.value)}
                placeholder={`## Instructions\n\nDescribe what the agent should do with this skill.\n\n- Use bullet points\n- Be specific about inputs/outputs`}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.name.trim()} onClick={handleSave}>
            {skill ? "Save changes" : "Create skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Minimal markdown → HTML (no external dep needed at this scale)
function mdToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/, "<ul>$1</ul>")
    .replace(/\n\n/g, "<br/><br/>")
}
