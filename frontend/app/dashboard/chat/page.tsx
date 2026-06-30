// Purpose: Chat page — LINE-style session list + agent trace conversation view
// Used by: sidebar navigation

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Loader2, Paperclip, Send, Trash2, X } from "lucide-react"
import { useAgents, usePipelines, useSessions } from "@/lib/store"
import { ChatBubble } from "@/components/chat/ChatBubble"
import { NewSessionDialog } from "@/components/chat/NewSessionDialog"
import { useSessionWS, type WSEvent } from "@/lib/useSessionWS"
import { uploadFile } from "@/lib/api"
import type { ChatMessage, SessionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

type BudgetAlert = { spendUsd: number; capUsd: number; pctUsed: number }

function getCompanyId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const s = JSON.parse(localStorage.getItem("korvuz:settings") || "{}")
    return (s.companyId as string)?.trim() || null
  } catch { return null }
}

function uid() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

const STATUS_DOT: Record<string, string> = {
  active:    "bg-neutral-400",
  running:   "bg-yellow-400 animate-pulse",
  completed: "bg-green-500",
  failed:    "bg-red-500",
}

export default function ChatPage() {
  const {
    sessions,
    createSession,
    deleteSession,
    appendMessage,
    runPipeline,
    agentChat,
    refreshSession,
    patchSessionLocal,
    appendMessageLocal,
  } = useSessions()
  const { pipelines } = usePipelines()
  const { agents } = useAgents()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<{ filename: string; downloadUrl: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Live WS state for the active session
  const [thinking, setThinking] = useState<{ agentId?: string; label: string } | null>(null)
  const [budgetAlert, setBudgetAlert] = useState<BudgetAlert | null>(null)

  const selected = sessions.find((s) => s.id === selectedId) ?? null
  const selectedPipeline = pipelines.find((p) => p.id === selected?.pipelineId)
  const selectedAgent = agents.find((a) => a.id === selected?.agentId)
  const isPipelineSession = !!selected?.pipelineId
  const isAgentSession = !!selected?.agentId
  const isRunning = selected?.status === "running"

  useEffect(() => {
    if (sessions.length > 0 && !selectedId) {
      setSelectedId(sessions[0].id)
    }
  }, [sessions, selectedId])

  // Reload messages from API whenever user selects a different session (picks up DB-side updates)
  useEffect(() => {
    if (selectedId) refreshSession(selectedId)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selected?.messages.length, thinking])

  // ── WebSocket event handler ───────────────────────────────────────────────────
  const handleWsEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case "agent_start":
        setThinking({ agentId: event.agent_id, label: "Starting..." })
        break

      case "agent_thought":
        setThinking((prev) => ({
          agentId: event.agent_id ?? prev?.agentId,
          label: event.content,
        }))
        break

      case "agent_done":
        // Backend already persisted this — update local state only
        setThinking(null)
        if (event.session_id) {
          const msg: ChatMessage = {
            id: uid(),
            role: "agent",
            agentId: event.agent_id || undefined,
            content: event.output,
            tokens: event.tokens,
            costUsd: event.cost_usd,
            latencyMs: event.latency_ms,
            createdAt: new Date().toISOString(),
          }
          appendMessageLocal(event.session_id, msg)
        }
        break

      case "pipeline_done":
        setThinking(null)
        if (event.session_id) {
          patchSessionLocal(event.session_id, {
            status: event.status as SessionStatus,
            totalCostUsd: event.total_cost_usd,
          })
        }
        break

      case "budget_alert":
        setBudgetAlert({
          spendUsd: event.spend_usd,
          capUsd: event.cap_usd,
          pctUsed: event.pct_used,
        })
        // Auto-dismiss after 10 s
        setTimeout(() => setBudgetAlert(null), 10_000)
        break
    }
  }, [appendMessageLocal, patchSessionLocal])

  // Connect WS for pipeline (isRunning) AND single-agent sessions (need agent_done events)
  useSessionWS(selectedId, isRunning || isAgentSession, handleWsEvent)

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleSend() {
    if ((!input.trim() && !pendingFile) || !selectedId || isRunning || !!thinking) return

    let content = ""
    if (pendingFile) {
      content = `📎 ${pendingFile.filename}\n${pendingFile.downloadUrl}`
      if (input.trim()) content += `\n\n${input.trim()}`
    } else {
      content = input.trim()
    }

    setInput("")
    setPendingFile(null)
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    // Completed pipeline session: re-run the same pipeline with the new message as task
    if (isPipelineSession && selected && !isRunning) {
      setIsCreating(true)
      try {
        const session = await runPipeline(selected.pipelineId!, content)
        if (session) setSelectedId(session.id)
      } catch (err) {
        console.error("Failed to re-run pipeline:", err)
      } finally {
        setIsCreating(false)
      }
      return
    }

    // Single-agent session: show user message immediately, call backend for AI response
    if (isAgentSession && selected) {
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      }
      appendMessageLocal(selectedId, userMsg)
      try {
        await agentChat(selectedId, content)
        // WS agent_done event will bring the AI response via appendMessageLocal
      } catch (err) {
        console.error("Agent chat error:", err)
      }
      return
    }

    const msg: ChatMessage = {
      id: uid(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    }
    appendMessage(selectedId, msg)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
  }

  async function handleCreate(name: string, target: { pipelineId: string; provider?: string } | { agentId: string; provider?: string }) {
    setIsCreating(true)
    try {
      if ("pipelineId" in target) {
        // Pipeline run: POST /pipelines/{id}/run — backend creates session + runs crew
        const session = await runPipeline(target.pipelineId, name, target.provider)
        if (session) setSelectedId(session.id)
      } else {
        // Single-agent session — status "active" not "running" (no background runner)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { provider: _provider, ...sessionTarget } = target
        const session = await createSession({
          name,
          ...sessionTarget,
          messages: [],
          totalCostUsd: 0,
          status: "active",
        })
        setSelectedId(session.id)
      }
    } catch (err) {
      console.error("Failed to create session:", err)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be selected again
    e.target.value = ""

    const cid = getCompanyId()
    if (!cid || !selectedId) {
      alert("File upload requires backend mode (set Company ID in Settings)")
      return
    }

    setIsUploading(true)
    try {
      const result = await uploadFile(cid, selectedId, file)
      setPendingFile({ filename: result.filename, downloadUrl: result.download_url })
    } catch (err) {
      console.error("Upload failed:", err)
      alert("Upload failed — check console for details")
    } finally {
      setIsUploading(false)
    }
  }

  const thinkingAgent = agents.find((a) => a.id === thinking?.agentId)

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* ── Budget alert banner ──────────────────────────────────────────────── */}
      {budgetAlert && (
        <div className="absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg max-w-md">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-amber-800">Budget alert — {budgetAlert.pctUsed}% used</p>
            <p className="text-amber-700">${budgetAlert.spendUsd.toFixed(4)} of ${budgetAlert.capUsd.toFixed(2)} this month</p>
          </div>
          <button onClick={() => setBudgetAlert(null)} className="text-amber-600 hover:text-amber-900">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Session sidebar ──────────────────────────────────────────────────── */}
      <div className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-3">
          <button
            onClick={() => setNewOpen(true)}
            disabled={isCreating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {isCreating && <Loader2 className="h-3 w-3 animate-spin" />}
            + New session
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {sessions.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">No sessions yet</p>
          )}
          {sessions.map((s) => {
            const pipeline = pipelines.find((p) => p.id === s.pipelineId)
            const agent = agents.find((a) => a.id === s.agentId)
            const subtitle = pipeline?.name ?? (agent ? agent.name : "—")
            return (
              <button
                key={s.id}
                onClick={() => { setSelectedId(s.id); setThinking(null) }}
                className={cn(
                  "group relative w-full px-3 py-2.5 text-left transition hover:bg-muted",
                  selectedId === s.id && "bg-primary/5 border-r-2 border-primary"
                )}
              >
                <div className="flex items-start gap-2 pr-5">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[s.status] ?? "bg-neutral-400")} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{s.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
                    {s.totalCostUsd > 0 && (
                      <p className="text-[10px] font-mono text-muted-foreground/60">${s.totalCostUsd.toFixed(4)}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(s.id)
                    if (selectedId === s.id) setSelectedId(null)
                  }}
                  className="absolute right-2 top-2.5 hidden rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main chat area ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <p className="text-sm">Select a session or start a new one</p>
            <button
              onClick={() => setNewOpen(true)}
              className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-muted"
            >
              + New session
            </button>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedPipeline?.name ?? (selectedAgent ? selectedAgent.name : "—")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isRunning && <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />}
                <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[selected.status] ?? "bg-neutral-400")} />
                <span className="text-xs capitalize text-muted-foreground">{selected.status}</span>
                {selected.status === "completed" && (() => {
                  const agentMsgs = selected.messages.filter(m => m.role === "agent")
                  const totalMs = agentMsgs.reduce((s, m) => s + (m.latencyMs ?? 0), 0)
                  return totalMs > 0 ? (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {totalMs >= 60000
                        ? `${Math.floor(totalMs / 60000)}m ${Math.round((totalMs % 60000) / 1000)}s`
                        : `${(totalMs / 1000).toFixed(1)}s`}
                    </span>
                  ) : null
                })()}
                {selected.totalCostUsd > 0 && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                    ${selected.totalCostUsd.toFixed(4)}
                  </span>
                )}
              </div>
            </div>

            {/* Messages — flex-col so spacer can push messages to bottom */}
            <div className="flex flex-col flex-1 overflow-y-auto py-3">
              {selected.messages.length === 0 && !thinking ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                  {isRunning ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin opacity-40" />
                      <p className="text-sm">Pipeline is running…</p>
                    </>
                  ) : (
                    <p className="text-sm">No messages yet</p>
                  )}
                </div>
              ) : (
                <div className="flex-1" />
              )}
              {selected.messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  agent={agents.find((a) => a.id === msg.agentId)}
                />
              ))}

              {/* Live thinking indicator */}
              {thinking && (
                <div className="flex items-start gap-2 px-5 py-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium">
                    {thinkingAgent?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thinkingAgent.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>{thinkingAgent?.name?.slice(0, 1) ?? "A"}</span>
                    )}
                  </div>
                  <div className="max-w-[70%] rounded-xl rounded-tl-none bg-muted px-3 py-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="animate-bounce text-[10px]" style={{ animationDelay: "0ms" }}>●</span>
                      <span className="animate-bounce text-[10px]" style={{ animationDelay: "150ms" }}>●</span>
                      <span className="animate-bounce text-[10px]" style={{ animationDelay: "300ms" }}>●</span>
                      <span className="ml-0.5 text-[10px] text-muted-foreground/80">
                        {thinkingAgent?.name ?? "Agent"} is thinking…
                      </span>
                    </div>
                    {thinking.label && thinking.label !== "Starting..." && (
                      <p className="mt-1 text-[11px] italic text-muted-foreground/60 line-clamp-2">
                        {thinking.label}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input bar — hidden while pipeline is actively running */}
            {isPipelineSession && isRunning ? (
              <div className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground/60">
                Pipeline is running — output will appear above in real-time
              </div>
            ) : (
              <div className="border-t border-border p-4">
                {/* Pending file chip */}
                {pendingFile && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-foreground">{pendingFile.filename}</span>
                    <button
                      onClick={() => setPendingFile(null)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-primary/40">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || !selectedId}
                    title={!getCompanyId() ? "File upload requires backend mode (set Company ID in Settings)" : "Attach file"}
                    className="mb-0.5 shrink-0 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                  >
                    {isUploading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Paperclip className="h-4 w-4" />
                    }
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      pendingFile
                        ? "Add a message (optional)…"
                        : isPipelineSession
                          ? "พิมพ์ task ใหม่แล้ว Enter — จะ run pipeline เดิมอีกครั้ง"
                          : "Type a message… (Enter to send, Shift+Enter for new line)"
                    }
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    style={{ minHeight: "1.5rem", maxHeight: "8rem" }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() && !pendingFile}
                    className="mb-0.5 shrink-0 rounded-lg bg-primary p-1.5 text-primary-foreground transition disabled:opacity-40 enabled:hover:opacity-90"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <NewSessionDialog
        open={newOpen}
        pipelines={pipelines}
        agents={agents}
        onCreate={handleCreate}
        onClose={() => setNewOpen(false)}
      />
    </div>
  )
}
