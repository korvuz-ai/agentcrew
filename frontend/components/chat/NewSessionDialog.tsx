// Purpose: Dialog to start a new chat session — pick pipeline OR single agent
// Used by: app/dashboard/chat/page.tsx

"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { Agent, Pipeline } from "@/lib/types"

type Mode = "pipeline" | "agent"

const PROVIDERS = [
  { value: "",       label: "Auto (ใช้ key ที่มี)" },
  { value: "claude", label: "Claude" },
  { value: "gemini", label: "Gemini" },
  { value: "gpt",    label: "GPT" },
]

interface Props {
  open: boolean
  pipelines: Pipeline[]
  agents: Agent[]
  onCreate: (name: string, target: { pipelineId: string; provider?: string } | { agentId: string; provider?: string }) => void
  onClose: () => void
}

export function NewSessionDialog({ open, pipelines, agents, onCreate, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("pipeline")
  const [name, setName] = useState("")
  const [pipelineId, setPipelineId] = useState("")
  const [agentId, setAgentId] = useState("")
  const [provider, setProvider] = useState("")

  // Auto-select first pipeline once pipelines load (useState initializer runs before async data arrives)
  useEffect(() => {
    setPipelineId(prev => prev || (pipelines[0]?.id ?? ""))
  }, [pipelines])

  function resetForm(keepProvider = false) {
    setName("")
    setPipelineId(pipelines[0]?.id ?? "")
    setAgentId("")
    setMode("pipeline")
    if (!keepProvider) setProvider("")
  }

  function handleCreate() {
    if (mode === "pipeline" && !pipelineId) return
    if (mode === "agent" && !agentId) return

    let sessionName = name.trim()
    if (!sessionName) {
      if (mode === "pipeline") {
        const p = pipelines.find((p) => p.id === pipelineId)
        sessionName = p ? p.name : "New Session"
      } else {
        const a = agents.find((a) => a.id === agentId)
        sessionName = a ? `Chat with ${a.name}` : "New Session"
      }
    }

    if (mode === "pipeline") {
      onCreate(sessionName, { pipelineId, provider: provider || undefined })
    } else {
      onCreate(sessionName, { agentId, provider: provider || undefined })
    }
    resetForm(true)
    onClose()
  }

  const valid = mode === "pipeline" ? !!pipelineId : !!agentId

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
          <p className="text-xs text-muted-foreground">Pipeline = รัน crew AI จริง · Single Agent = chat เฉยๆ ไม่มี AI</p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border p-1">
            {(["pipeline", "agent"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md py-1.5 text-xs font-medium transition ${
                  mode === m
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "pipeline" ? "🚀 Pipeline" : "💬 Single Agent"}
              </button>
            ))}
          </div>

          {/* Pipeline mode */}
          {mode === "pipeline" && (
            <>
              <div className="space-y-1.5">
                <Label>Pipeline</Label>
                {pipelines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pipelines yet — create one first.</p>
                ) : (
                  <select
                    value={pipelineId}
                    onChange={(e) => setPipelineId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select a pipeline…</option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Provider (API Key)</Label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">ตั้ง API key ที่ Settings ก่อน — Auto จะใช้ key แรกที่มี</p>
              </div>

              <div className="space-y-1.5">
                <Label>Task <span className="text-muted-foreground/60">(optional)</span></Label>
                <textarea
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Write a blog post about AI agents for Thai SMEs"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <p className="text-[10px] text-muted-foreground">งานที่ส่งให้ crew — ถ้าว่างจะใช้ชื่อ pipeline</p>
              </div>
            </>
          )}

          {/* Single Agent mode */}
          {mode === "agent" && (
            <>
              <div className="space-y-1.5">
                <Label>Agent</Label>
                {agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No agents yet — create one first.</p>
                ) : (
                  <select
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select an agent…</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} · {a.role}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Provider (API Key)</Label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">ตั้ง API key ที่ Settings ก่อน — Auto จะใช้ key แรกที่มี</p>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Session name{" "}
                  <span className="text-muted-foreground/60">(optional)</span>
                </Label>
                <textarea
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto-generated from agent name"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} onClick={handleCreate}>Start session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
