// Purpose: Single chat message bubble — user (right) or agent (left) with thinking + stats
// Used by: app/dashboard/chat/page.tsx

"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronDown, ChevronRight, FileText, Image as ImageIcon } from "lucide-react"
import type { Agent, ChatMessage } from "@/lib/types"

// File attachment: content starts with "📎 filename\ndownload_url"
function parseFileAttachment(content: string): { filename: string; url: string; text: string } | null {
  if (!content.startsWith("📎 ")) return null
  const newline = content.indexOf("\n")
  if (newline === -1) return null
  const filename = content.slice(3, newline).trim()
  const rest = content.slice(newline + 1)
  const nextNewline = rest.indexOf("\n")
  const url = (nextNewline === -1 ? rest : rest.slice(0, nextNewline)).trim()
  const text = nextNewline === -1 ? "" : rest.slice(nextNewline + 1).trim()
  return url ? { filename, url, text } : null
}

function FileChip({ filename, url }: { filename: string; url: string }) {
  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(filename)
  const Icon = isImage ? ImageIcon : FileText
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{filename}</span>
      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">open</span>
    </a>
  )
}

interface Props {
  message: ChatMessage
  agent?: Agent
}

export function ChatBubble({ message, agent }: Props) {
  const [thinkingOpen, setThinkingOpen] = useState(false)

  if (message.role === "user") {
    const file = parseFileAttachment(message.content)
    return (
      <div className="flex justify-end px-4 py-1">
        <div className="max-w-[70%] space-y-1.5">
          {file && <FileChip filename={file.filename} url={file.url} />}
          {(file ? file.text : message.content) && (
            <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap">
              {file ? file.text : message.content}
            </div>
          )}
        </div>
      </div>
    )
  }

  const isImage = agent?.avatar.endsWith(".png") || agent?.avatar.endsWith(".jpg")

  return (
    <div className="flex gap-2.5 px-4 py-1">
      <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary/60">
        {isImage ? (
          <Image src={`/agents/${agent!.avatar}`} alt={agent!.name} width={32} height={32} className="object-contain" />
        ) : (
          <span className="text-sm">{agent?.avatar ?? "🤖"}</span>
        )}
      </div>

      <div className="max-w-[75%] space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          {agent?.name ?? "Agent"} · <span className="font-normal">{agent?.role}</span>
        </p>

        {message.thinking && (
          <>
            <button
              onClick={() => setThinkingOpen((o) => !o)}
              className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground"
            >
              {thinkingOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Thinking…
            </button>
            {thinkingOpen && (
              <div className="rounded-xl rounded-tl-sm bg-muted/60 px-3 py-2 text-xs italic text-muted-foreground">
                {message.thinking}
              </div>
            )}
          </>
        )}

        <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground whitespace-pre-wrap">
          {message.content}
        </div>

        {(message.tokens !== undefined || message.costUsd !== undefined || message.latencyMs !== undefined) && (
          <p className="text-[10px] text-muted-foreground/50">
            {message.tokens !== undefined && `${message.tokens.toLocaleString()} tokens`}
            {message.costUsd !== undefined && ` · $${message.costUsd.toFixed(4)}`}
            {message.latencyMs !== undefined && ` · ${message.latencyMs.toLocaleString()}ms`}
          </p>
        )}
      </div>
    </div>
  )
}
