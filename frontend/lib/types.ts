// Purpose: Shared TypeScript types for agents, skills, and pipelines across the app
// Used by: lib/store.ts, all agent/skill/pipeline components

export type Provider = "claude" | "gemini" | "gpt"
export type Level = 1 | 2 | 3

export interface Agent {
  id: string
  name: string
  role: string
  backstory: string
  avatar: string        // emoji "🤖" OR image filename "CEO-Fi.png"
  managerId?: string    // parent agent id — builds org chart hierarchy
  level: Level
  providers: Provider[]
  skillIds: string[]
  systemPromptOverride: string
  cwd?: string              // optional server path — enables file/shell tools when set
  createdAt: string
}

export interface Skill {
  id: string
  name: string
  description: string
  category: string
  instructions: string  // markdown
  createdAt: string
}

// Images in /public/agents/ (no duplicates)
export const AGENT_IMAGES = [
  "CEO-Fi.png",
  "CTO.png",
  "CFO.png",
  "AI-Engineer.png",
  "Lead-Developer.png",
  "LIFF-Developer.png",
  "Head-of-UXUI.png",
  "Content-SEO-Writer.png",
  "Marketing-Manager.png",
  "Staff.png",
  "CEO-Invoice.png",
  "Compliance-Invoice.png",
  "Infrastructure-invoice.png",
] as const

export const LEVEL_LABEL: Record<Level, string> = { 1: "Junior", 2: "Mid", 3: "Senior" }

export const LEVEL_COLOR: Record<Level, string> = {
  1: "text-orange-700 bg-orange-100 border-orange-200",
  2: "text-neutral-600 bg-neutral-100 border-neutral-200",
  3: "text-amber-700 bg-amber-100 border-amber-200",
}

export const LEVEL_MODELS: Record<Level, Record<Provider, string>> = {
  1: { claude: "Haiku 4.5",  gemini: "Flash-Lite",     gpt: "GPT-5.5 Instant" },
  2: { claude: "Sonnet 4.6", gemini: "Pro",             gpt: "GPT-5.5" },
  3: { claude: "Opus 4.8",   gemini: "Pro Deep Think",  gpt: "GPT-5.5 Pro" },
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  claude: "Claude", gemini: "Gemini", gpt: "GPT",
}

export const PROVIDER_COLOR: Record<Provider, string> = {
  claude: "bg-violet-100 text-violet-700 border-violet-200",
  gemini: "bg-blue-100 text-blue-700 border-blue-200",
  gpt:    "bg-emerald-100 text-emerald-700 border-emerald-200",
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export type PipelineType = "orchestrator-worker" | "sequential"

export interface PipelineNode {
  id: string
  agentId: string
  condition: string  // optional condition text (used in orchestrator-worker workers)
}

export interface Pipeline {
  id: string
  name: string
  description: string
  type: PipelineType
  orchestratorId: string   // orchestrator-worker only
  nodes: PipelineNode[]    // workers (O-W) or ordered steps (sequential)
  cwd?: string             // working directory context for this pipeline run
  createdAt: string
}

// ── Chat / Session ────────────────────────────────────────────────────────────

export type SessionStatus = "active" | "running" | "completed" | "failed"

export interface ChatMessage {
  id: string
  role: "user" | "agent"
  agentId?: string
  content: string
  thinking?: string     // collapsible pre-message reasoning
  tokens?: number
  costUsd?: number
  latencyMs?: number
  createdAt: string
}

export interface Session {
  id: string
  name: string
  pipelineId?: string   // set when mode = pipeline
  agentId?: string      // set when mode = single-agent
  messages: ChatMessage[]
  totalCostUsd: number
  status: SessionStatus
  createdAt: string
}

// ── App Settings ──────────────────────────────────────────────────────────────

export interface AppSettings {
  companyId: string          // UUID of the company in DB — set to enable API mode
  providerKeys: Record<Provider, string>
  budgetCapUsd: number
  alertThresholdPct: number
}
