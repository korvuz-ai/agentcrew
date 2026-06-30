// Purpose: Create / edit pipeline dialog — type toggle, orchestrator/worker or sequential step builder
// Used by: app/dashboard/pipelines/page.tsx

"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Agent, Pipeline, PipelineNode, PipelineType } from "@/lib/types"

function uid() {
  return typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function newNode(): PipelineNode {
  return { id: uid(), agentId: "", condition: "" }
}

interface Props {
  open: boolean
  pipeline?: Pipeline | null
  agents: Agent[]
  onSave: (data: Omit<Pipeline, "id" | "createdAt">) => void
  onClose: () => void
}

const EMPTY = (): Omit<Pipeline, "id" | "createdAt"> => ({
  name: "",
  description: "",
  type: "orchestrator-worker",
  orchestratorId: "",
  nodes: [],
  cwd: "",
})

export function PipelineDialog({ open, pipeline, agents, onSave, onClose }: Props) {
  const [form, setForm] = useState(EMPTY())

  useEffect(() => {
    setForm(pipeline ? { ...pipeline } : EMPTY())
  }, [pipeline, open])

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function addNode() {
    set("nodes", [...form.nodes, newNode()])
  }

  function removeNode(i: number) {
    set("nodes", form.nodes.filter((_, idx) => idx !== i))
  }

  function updateNode(i: number, patch: Partial<PipelineNode>) {
    set("nodes", form.nodes.map((n, idx) => idx === i ? { ...n, ...patch } : n))
  }

  function moveNode(i: number, dir: -1 | 1) {
    const next = [...form.nodes]
    const t = i + dir
    if (t < 0 || t >= next.length) return
    ;[next[i], next[t]] = [next[t], next[i]]
    set("nodes", next)
  }

  function handleSave() {
    if (!form.name.trim()) return
    onSave(form)
    onClose()
  }

  const valid = form.name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pipeline ? "Edit Pipeline" : "New Pipeline"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Name + Description */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Pipeline name</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Customer Support Crew"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="What does this pipeline do?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Working directory{" "}
                <span className="text-muted-foreground/60">(optional)</span>
              </Label>
              <Input
                value={form.cwd ?? ""}
                onChange={(e) => set("cwd", e.target.value)}
                placeholder="/home/user/project — sets file/shell context for this run"
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Type toggle */}
          <div className="space-y-1.5">
            <Label>Pipeline type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["orchestrator-worker", "sequential"] as PipelineType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("type", t)}
                  className={`rounded-lg border p-3 text-left transition ${
                    form.type === t
                      ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {t === "orchestrator-worker" ? "Orchestrator-Worker" : "Sequential"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t === "orchestrator-worker"
                      ? "One agent directs multiple workers"
                      : "Agents run one after another in order"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Orchestrator-Worker */}
          {form.type === "orchestrator-worker" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Orchestrator agent</Label>
                <AgentSelect
                  value={form.orchestratorId}
                  agents={agents}
                  placeholder="Select orchestrator..."
                  onChange={(v) => set("orchestratorId", v)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Worker agents</Label>
                  <span className="text-xs text-muted-foreground">{form.nodes.length} worker{form.nodes.length !== 1 ? "s" : ""}</span>
                </div>

                {form.nodes.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    No workers yet — add at least one below
                  </p>
                )}

                {form.nodes.map((node, i) => (
                  <div key={node.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
                    <div className="flex-1 space-y-2">
                      <AgentSelect
                        value={node.agentId}
                        agents={agents}
                        placeholder="Select worker agent..."
                        onChange={(v) => updateNode(i, { agentId: v })}
                      />
                      <Input
                        value={node.condition}
                        onChange={(e) => updateNode(i, { condition: e.target.value })}
                        placeholder="Condition (optional) — e.g. when research is needed"
                        className="text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNode(i)}
                      className="mt-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addNode}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add worker
                </button>
              </div>
            </div>
          )}

          {/* Sequential */}
          {form.type === "sequential" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <span className="text-xs text-muted-foreground">{form.nodes.length} step{form.nodes.length !== 1 ? "s" : ""}</span>
              </div>

              {form.nodes.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No steps yet — add your first step below
                </p>
              )}

              {form.nodes.map((node, i) => (
                <div key={node.id}>
                  <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <AgentSelect
                        value={node.agentId}
                        agents={agents}
                        placeholder="Select agent..."
                        onChange={(v) => updateNode(i, { agentId: v })}
                      />
                    </div>
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveNode(i, -1)}
                        disabled={i === 0}
                        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveNode(i, 1)}
                        disabled={i === form.nodes.length - 1}
                        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNode(i)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {i < form.nodes.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addNode}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Add step
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="outline"
            disabled
            title="Available once backend is connected (Phase 3)"
          >
            Run now
          </Button>
          <Button disabled={!valid} onClick={handleSave}>
            {pipeline ? "Save changes" : "Create pipeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AgentSelect({
  value, agents, placeholder, onChange,
}: {
  value: string
  agents: Agent[]
  placeholder: string
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">{placeholder}</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} · {a.role}
        </option>
      ))}
    </select>
  )
}
