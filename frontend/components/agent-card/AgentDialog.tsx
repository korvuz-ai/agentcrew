// Purpose: Create / edit agent dialog — level picker, provider toggles, skill assignment
// Used by: app/dashboard/agents/page.tsx

"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FolderOpen } from "lucide-react"
import {
  AGENT_IMAGES, LEVEL_COLOR, LEVEL_LABEL, LEVEL_MODELS, PROVIDER_COLOR, PROVIDER_LABEL,
  type Agent, type Level, type Provider, type Skill,
} from "@/lib/types"

const ALL_PROVIDERS: Provider[] = ["claude", "gemini", "gpt"]
const ALL_LEVELS: Level[] = [1, 2, 3]

interface Props {
  open: boolean
  agent?: Agent | null      // null = create mode
  skills: Skill[]
  allAgents?: Agent[]       // for "Reports to" dropdown
  onSave: (data: Omit<Agent, "id" | "createdAt">) => void
  onClose: () => void
}

const EMPTY = (): Omit<Agent, "id" | "createdAt"> => ({
  name: "",
  role: "",
  backstory: "",
  avatar: "CEO-Fi.png",
  managerId: undefined,
  level: 2,
  providers: ["claude"],
  skillIds: [],
  systemPromptOverride: "",
  cwd: "",
})

export function AgentDialog({ open, agent, skills, allAgents = [], onSave, onClose }: Props) {
  const [form, setForm] = useState(EMPTY())

  useEffect(() => {
    setForm(agent ? { ...agent } : EMPTY())
  }, [agent, open])

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function toggleProvider(p: Provider) {
    set("providers", form.providers.includes(p)
      ? form.providers.filter((x) => x !== p)
      : [...form.providers, p]
    )
  }

  function toggleSkill(id: string) {
    set("skillIds", form.skillIds.includes(id)
      ? form.skillIds.filter((x) => x !== id)
      : [...form.skillIds, id]
    )
  }

  function handleSave() {
    if (!form.name.trim() || !form.role.trim() || form.providers.length === 0) return
    onSave(form)
    onClose()
  }

  const valid = form.name.trim() && form.role.trim() && form.providers.length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit Agent" : "New Agent"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Avatar picker — images */}
          <div className="space-y-2">
            <Label>Avatar</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {AGENT_IMAGES.map((img) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => set("avatar", img)}
                  className={`relative overflow-hidden rounded-lg border bg-secondary/50 transition aspect-square ${
                    form.avatar === img
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <Image src={`/agents/${img}`} alt={img} fill className="object-contain p-0.5" />
                </button>
              ))}
            </div>
            {/* Emoji fallback row */}
            <div className="flex flex-wrap gap-1">
              {["🤖","🧠","✍️","⚙️","📊","🗺️","🔍","💡","🛡️","🎯","📈","🧪","🌐","📝","🔧","🎨","📣","🤝","⚡","🔮"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => set("avatar", emoji)}
                  className={`rounded-lg border p-1 text-lg transition ${
                    form.avatar === emoji
                      ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name + Role */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Alex" />
            </div>
            <div className="space-y-1.5">
              <Label>Role / Title</Label>
              <Input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Researcher" />
            </div>
          </div>

          {/* Backstory */}
          <div className="space-y-1.5">
            <Label>Backstory / Personality</Label>
            <Textarea
              rows={3}
              value={form.backstory}
              onChange={(e) => set("backstory", e.target.value)}
              placeholder="Describe the agent's personality, expertise, and working style..."
            />
          </div>

          {/* Level */}
          <div className="space-y-1.5">
            <Label>Level</Label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => set("level", lv)}
                  className={`rounded-lg border p-2.5 text-center transition ${
                    form.level === lv
                      ? `${LEVEL_COLOR[lv]} ring-1 ring-current`
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <p className="text-xs font-bold">Lv.{lv}</p>
                  <p className="text-[11px] font-medium">{LEVEL_LABEL[lv]}</p>
                  <p className="mt-1 text-[10px] opacity-70">{LEVEL_MODELS[lv].claude}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Providers */}
          <div className="space-y-1.5">
            <Label>Allowed LLM Providers</Label>
            <div className="flex gap-2">
              {ALL_PROVIDERS.map((p) => {
                const active = form.providers.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProvider(p)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                      active ? PROVIDER_COLOR[p] : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {PROVIDER_LABEL[p]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Reports to */}
          {allAgents.filter(a => a.id !== agent?.id).length > 0 && (
            <div className="space-y-1.5">
              <Label>Reports to</Label>
              <select
                value={form.managerId ?? ""}
                onChange={(e) => set("managerId", e.target.value || undefined)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— None (Top-level) —</option>
                {allAgents
                  .filter(a => a.id !== agent?.id)
                  .map(a => (
                    <option key={a.id} value={a.id}>{a.name} · {a.role}</option>
                  ))
                }
              </select>
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="space-y-1.5">
              <Label>Skills</Label>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => {
                  const selected = form.skillIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSkill(s.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        selected
                          ? "border-primary/40 bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {s.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Server Access (cwd) */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Server path
              <span className="text-muted-foreground/60 font-normal">(optional)</span>
            </Label>
            <Input
              value={form.cwd ?? ""}
              onChange={(e) => set("cwd", e.target.value || undefined)}
              placeholder="/opt/agent-company"
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {form.cwd
                ? <span className="text-emerald-600 font-medium">✓ Agent จะเข้า server ได้ — อ่านไฟล์ / รัน command ใน path นี้</span>
                : "ไม่ใส่ = agent ตอบคำถามปกติ ไม่มี file access"}
            </p>
          </div>

          {/* System prompt override */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Advanced — System prompt override
            </summary>
            <Textarea
              className="mt-2 font-mono text-xs"
              rows={4}
              value={form.systemPromptOverride}
              onChange={(e) => set("systemPromptOverride", e.target.value)}
              placeholder="Override the system prompt generated from backstory + skills. Leave empty to auto-generate."
            />
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} onClick={handleSave}>
            {agent ? "Save changes" : "Create agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
