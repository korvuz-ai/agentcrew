// Purpose: History page — searchable session table + read-only chat replay dialog
// Used by: sidebar navigation

"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { useAgents, usePipelines, useSessions } from "@/lib/store"
import { ChatBubble } from "@/components/chat/ChatBubble"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import type { Session } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_CHIP: Record<string, string> = {
  completed: "border-green-200 bg-green-50 text-green-700",
  running:   "border-yellow-200 bg-yellow-50 text-yellow-700",
  failed:    "border-red-200 bg-red-50 text-red-700",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

export default function HistoryPage() {
  const { sessions } = useSessions()
  const { pipelines } = usePipelines()
  const { agents } = useAgents()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selected, setSelected] = useState<Session | null>(null)

  const filtered = useMemo(() => {
    return [...sessions].reverse().filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [sessions, search, statusFilter])

  return (
    <div className="flex-1 overflow-y-auto p-6">
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">History</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} total
        </p>
      </div>

      {/* Search + filter */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="running">Running</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {sessions.length === 0 ? "No sessions yet — start a chat to create one." : "No sessions match your filters."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Session</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pipeline</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Messages</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s) => {
                const pipeline = pipelines.find((p) => p.id === s.pipelineId)
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="cursor-pointer transition hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{pipeline?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {s.totalCostUsd > 0 ? `$${s.totalCostUsd.toFixed(4)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{s.messages.length}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", STATUS_CHIP[s.status])}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Read-only chat replay dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl flex flex-col p-0 gap-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-base">{selected?.name}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {pipelines.find((p) => p.id === selected?.pipelineId)?.name ?? "—"}
              {selected && selected.totalCostUsd > 0 && ` · $${selected.totalCostUsd.toFixed(4)} total`}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-3">
            {selected?.messages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No messages in this session.</p>
            )}
            {selected?.messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                agent={agents.find((a) => a.id === msg.agentId)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}
