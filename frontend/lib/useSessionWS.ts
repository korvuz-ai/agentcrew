// Purpose: WebSocket hook for real-time session event streaming (B5)
// Used by: chat page (live thinking/done), office page (live desk states)

"use client"

import { useEffect, useRef } from "react"

export type WSEvent =
  | { type: "agent_start"; session_id: string; agent_id: string }
  | { type: "agent_thought"; session_id: string; content: string; agent_id?: string }
  | { type: "agent_done"; session_id: string; agent_id: string; output: string; tokens?: number; cost_usd?: number; latency_ms?: number }
  | { type: "pipeline_done"; session_id: string; status: string; total_cost_usd: number }
  | { type: "budget_alert"; session_id: string; spend_usd: number; cap_usd: number; pct_used: number; threshold_pct: number }

function getWsUrl(sessionId: string): string {
  if (typeof window === "undefined") return ""
  // In production: auto-detect from browser location (nginx proxies /ws/ → backend)
  // In local dev without nginx: set NEXT_PUBLIC_WS_OVERRIDE=ws://127.0.0.1:8791
  const override = process.env.NEXT_PUBLIC_WS_OVERRIDE
  if (override) return `${override}/ws/sessions/${sessionId}`
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${window.location.host}/ws/sessions/${sessionId}`
}

export function useSessionWS(
  sessionId: string | null | undefined,
  isActive: boolean,
  onEvent: (event: WSEvent) => void,
) {
  // Use ref so the effect never needs to re-run just because onEvent identity changed
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!sessionId || !isActive) return

    const url = getWsUrl(sessionId)
    if (!url) return

    let ws: WebSocket | null = null
    let dead = false
    let retryTimer: ReturnType<typeof setTimeout>

    const connect = () => {
      if (dead) return
      try {
        ws = new WebSocket(url)

        ws.onmessage = (e) => {
          try {
            onEventRef.current(JSON.parse(e.data) as WSEvent)
          } catch {
            // ignore malformed JSON
          }
        }

        ws.onclose = () => {
          if (!dead) retryTimer = setTimeout(connect, 3000)
        }

        ws.onerror = () => ws?.close()
      } catch {
        if (!dead) retryTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      dead = true
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, [sessionId, isActive])
}
