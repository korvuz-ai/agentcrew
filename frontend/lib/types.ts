// Purpose: Shared TypeScript types for agents, skills, and pipelines across the app
// Used by: lib/store.ts, all agent/skill/pipeline components

export type Provider = "claude" | "gemini" | "gpt"
export type Level = 1 | 2 | 3

export interface Agent {
  id: string
  name: string
  role: string
  backstory: string
  level: Level
  providers: Provider[]
  skillIds: string[]
  systemPromptOverride: string
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

// Level display helpers
export const LEVEL_LABEL: Record<Level, string> = {
  1: "Junior",
  2: "Mid",
  3: "Senior",
}

export const LEVEL_COLOR: Record<Level, string> = {
  1: "text-orange-700 bg-orange-100 border-orange-200",
  2: "text-neutral-600 bg-neutral-100 border-neutral-200",
  3: "text-amber-700 bg-amber-100 border-amber-200",
}

// Level → model mapping (matches CLAUDE.md decision log)
export const LEVEL_MODELS: Record<Level, Record<Provider, string>> = {
  1: { claude: "Haiku 4.5",   gemini: "Flash-Lite", gpt: "GPT-5.5 Instant" },
  2: { claude: "Sonnet 4.6",  gemini: "Pro",        gpt: "GPT-5.5" },
  3: { claude: "Opus 4.8",    gemini: "Pro Deep Think", gpt: "GPT-5.5 Pro" },
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  claude: "Claude",
  gemini: "Gemini",
  gpt: "GPT",
}

export const PROVIDER_COLOR: Record<Provider, string> = {
  claude: "bg-violet-100 text-violet-700 border-violet-200",
  gemini: "bg-blue-100 text-blue-700 border-blue-200",
  gpt: "bg-emerald-100 text-emerald-700 border-emerald-200",
}
