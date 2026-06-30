// Purpose: Data store — API mode when companyId is configured, localStorage otherwise
// Used by: all dashboard pages

"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "./api"
import { buildDemoTeam } from "./seeds"
import type {
  Agent,
  AppSettings,
  ChatMessage,
  Level,
  Pipeline,
  PipelineType,
  Provider,
  Session,
  SessionStatus,
  Skill,
} from "./types"

const SEED_VERSION  = "v5"
const SEED_VER_KEY  = "korvuz:seed-version"
const AGENTS_KEY    = "korvuz:agents"
const SKILLS_KEY    = "korvuz:skills"
const PIPELINES_KEY = "korvuz:pipelines"
const SESSIONS_KEY  = "korvuz:sessions"
const SETTINGS_KEY  = "korvuz:settings"

const DEFAULT_SETTINGS: AppSettings = {
  companyId: "",
  providerKeys: { claude: "", gemini: "", gpt: "" },
  budgetCapUsd: 50,
  alertThresholdPct: 80,
}

// ── helpers ───────────────────────────────────────────────────────────────────

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLS<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function uid() {
  return typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function getCompanyId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as AppSettings
    return s.companyId?.trim() || null
  } catch {
    return null
  }
}

function ensureSeeded(): boolean {
  if (typeof window === "undefined") return false
  if (localStorage.getItem(SEED_VER_KEY) === SEED_VERSION) return false
  const { agents, skills, pipelines, sessions } = buildDemoTeam()
  writeLS(AGENTS_KEY, agents)
  writeLS(SKILLS_KEY, skills)
  writeLS(PIPELINES_KEY, pipelines)
  writeLS(SESSIONS_KEY, sessions)
  localStorage.setItem(SEED_VER_KEY, SEED_VERSION)
  return true
}

// ── field mappers: DB row ↔ frontend type ─────────────────────────────────────

type Row = Record<string, unknown>

function rowToAgent(r: Row): Agent {
  return {
    id: r.id as string,
    name: r.name as string,
    role: (r.role as string) ?? "",
    backstory: (r.backstory as string) ?? "",
    avatar: (r.avatar as string) ?? "",
    managerId: (r.manager_id as string | null) ?? undefined,
    level: (r.level as Level),
    providers: (r.providers as Provider[]) ?? [],
    skillIds: (r.skill_ids as string[]) ?? [],
    systemPromptOverride: (r.system_prompt as string) ?? "",
    cwd: (r.cwd as string | null) ?? undefined,
    createdAt: r.created_at as string,
  }
}

function agentToRow(a: Omit<Agent, "id" | "createdAt">): Row {
  return {
    name: a.name,
    role: a.role,
    backstory: a.backstory,
    avatar: a.avatar,
    manager_id: a.managerId ?? null,
    level: a.level,
    providers: a.providers,
    skill_ids: a.skillIds,
    system_prompt: a.systemPromptOverride,
    cwd: a.cwd ?? null,
  }
}

function rowToSkill(r: Row): Skill {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    category: (r.category as string) ?? "",
    instructions: (r.content as string) ?? "",
    createdAt: r.created_at as string,
  }
}

function skillToRow(s: Omit<Skill, "id" | "createdAt">): Row {
  return {
    name: s.name,
    description: s.description,
    category: s.category,
    content: s.instructions,
  }
}

function rowToPipeline(r: Row): Pipeline {
  const nodes = (r.nodes as Row[]) ?? []
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    type: (r.process_type as PipelineType),
    orchestratorId: (r.orchestrator_id as string) ?? "",
    nodes: nodes.map((n) => ({
      id: n.id as string,
      agentId: n.agent_id as string,
      condition: (n.condition as string) ?? "",
    })),
    cwd: (r.cwd as string | null) ?? undefined,
    createdAt: r.created_at as string,
  }
}

function pipelineToRow(p: Omit<Pipeline, "id" | "createdAt">): Row {
  return {
    name: p.name,
    description: p.description,
    process_type: p.type,
    orchestrator_id: p.orchestratorId || null,
    cwd: p.cwd ?? null,
    nodes: p.nodes.map((n, i) => ({
      agent_id: n.agentId,
      order_index: i,
      condition: n.condition,
    })),
  }
}

function rowToMessage(r: Row): ChatMessage {
  return {
    id: r.id as string,
    role: r.role as "user" | "agent",
    agentId: (r.agent_id as string | null) ?? undefined,
    content: r.content as string,
    thinking: (r.thinking as string | null) ?? undefined,
    tokens: (r.tokens_in as number) || undefined,
    costUsd: parseFloat((r.cost_usd as string) ?? "0") || undefined,
    latencyMs: (r.latency_ms as number) || undefined,
    createdAt: r.created_at as string,
  }
}

function messageToRow(m: ChatMessage): Row {
  return {
    role: m.role,
    content: m.content,
    agent_id: m.agentId ?? null,
    thinking: m.thinking ?? null,
    tokens_in: m.tokens ?? 0,
    cost_usd: m.costUsd ?? 0,
    latency_ms: m.latencyMs ?? 0,
  }
}

function rowToSession(r: Row): Session {
  const messages = (r.messages as Row[]) ?? []
  return {
    id: r.id as string,
    name: r.name as string,
    pipelineId: (r.pipeline_id as string | null) ?? undefined,
    agentId: (r.agent_id as string | null) ?? undefined,
    messages: messages.map(rowToMessage),
    totalCostUsd: parseFloat((r.total_cost_usd as string) ?? "0"),
    status: (r.status as SessionStatus) ?? "running",
    createdAt: r.created_at as string,
  }
}

// ── Agents ────────────────────────────────────────────────────────────────────

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    const cid = getCompanyId()
    if (cid) {
      apiFetch<Row[]>(`/api/companies/${cid}/agents`)
        .then((rows) => setAgents(rows.map(rowToAgent)))
        .catch(() => {
          ensureSeeded()
          setAgents(readLS<Agent[]>(AGENTS_KEY, []))
        })
    } else {
      ensureSeeded()
      setAgents(readLS<Agent[]>(AGENTS_KEY, []))
    }
  }, [])

  const save = useCallback((next: Agent[]) => {
    setAgents(next)
    writeLS(AGENTS_KEY, next)
  }, [])

  const createAgent = useCallback(
    async (data: Omit<Agent, "id" | "createdAt">): Promise<Agent> => {
      const cid = getCompanyId()
      if (cid) {
        const row = await apiFetch<Row>(`/api/companies/${cid}/agents`, {
          method: "POST",
          body: JSON.stringify(agentToRow(data)),
        })
        const agent = rowToAgent(row)
        setAgents((prev) => [...prev, agent])
        return agent
      }
      const agent: Agent = { ...data, id: uid(), createdAt: new Date().toISOString() }
      save([...readLS<Agent[]>(AGENTS_KEY, []), agent])
      return agent
    },
    [save]
  )

  const updateAgent = useCallback(
    async (id: string, data: Partial<Omit<Agent, "id" | "createdAt">>) => {
      const cid = getCompanyId()
      if (cid) {
        const row = await apiFetch<Row>(`/api/companies/${cid}/agents/${id}`, {
          method: "PATCH",
          body: JSON.stringify(agentToRow(data as Omit<Agent, "id" | "createdAt">)),
        })
        const updated = rowToAgent(row)
        setAgents((prev) => prev.map((a) => (a.id === id ? updated : a)))
        return
      }
      save(readLS<Agent[]>(AGENTS_KEY, []).map((a) => (a.id === id ? { ...a, ...data } : a)))
    },
    [save]
  )

  const deleteAgent = useCallback(
    async (id: string) => {
      const cid = getCompanyId()
      if (cid) {
        await apiFetch(`/api/companies/${cid}/agents/${id}`, { method: "DELETE" })
        setAgents((prev) => prev.filter((a) => a.id !== id))
        return
      }
      save(readLS<Agent[]>(AGENTS_KEY, []).filter((a) => a.id !== id))
    },
    [save]
  )

  const resetToDemo = useCallback(() => {
    const { agents: a, skills: s, pipelines: p, sessions: ss } = buildDemoTeam()
    writeLS(AGENTS_KEY, a)
    writeLS(SKILLS_KEY, s)
    writeLS(PIPELINES_KEY, p)
    writeLS(SESSIONS_KEY, ss)
    localStorage.setItem(SEED_VER_KEY, SEED_VERSION)
    setAgents(a)
  }, [])

  return { agents, createAgent, updateAgent, deleteAgent, resetToDemo }
}

// ── Skills ────────────────────────────────────────────────────────────────────

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([])

  useEffect(() => {
    const cid = getCompanyId()
    if (cid) {
      apiFetch<Row[]>(`/api/companies/${cid}/skills`)
        .then((rows) => setSkills(rows.map(rowToSkill)))
        .catch(() => setSkills(readLS<Skill[]>(SKILLS_KEY, [])))
    } else {
      setSkills(readLS<Skill[]>(SKILLS_KEY, []))
    }
  }, [])

  const save = useCallback((next: Skill[]) => {
    setSkills(next)
    writeLS(SKILLS_KEY, next)
  }, [])

  const createSkill = useCallback(
    async (data: Omit<Skill, "id" | "createdAt">): Promise<Skill> => {
      const cid = getCompanyId()
      if (cid) {
        const row = await apiFetch<Row>(`/api/companies/${cid}/skills`, {
          method: "POST",
          body: JSON.stringify(skillToRow(data)),
        })
        const skill = rowToSkill(row)
        setSkills((prev) => [...prev, skill])
        return skill
      }
      const skill: Skill = { ...data, id: uid(), createdAt: new Date().toISOString() }
      save([...readLS<Skill[]>(SKILLS_KEY, []), skill])
      return skill
    },
    [save]
  )

  const updateSkill = useCallback(
    async (id: string, data: Partial<Omit<Skill, "id" | "createdAt">>) => {
      const cid = getCompanyId()
      if (cid) {
        const row = await apiFetch<Row>(`/api/companies/${cid}/skills/${id}`, {
          method: "PATCH",
          body: JSON.stringify(skillToRow(data as Omit<Skill, "id" | "createdAt">)),
        })
        const updated = rowToSkill(row)
        setSkills((prev) => prev.map((s) => (s.id === id ? updated : s)))
        return
      }
      save(readLS<Skill[]>(SKILLS_KEY, []).map((s) => (s.id === id ? { ...s, ...data } : s)))
    },
    [save]
  )

  const deleteSkill = useCallback(
    async (id: string) => {
      const cid = getCompanyId()
      if (cid) {
        await apiFetch(`/api/companies/${cid}/skills/${id}`, { method: "DELETE" })
        setSkills((prev) => prev.filter((s) => s.id !== id))
        return
      }
      save(readLS<Skill[]>(SKILLS_KEY, []).filter((s) => s.id !== id))
    },
    [save]
  )

  return { skills, createSkill, updateSkill, deleteSkill }
}

// ── Pipelines ─────────────────────────────────────────────────────────────────

export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])

  useEffect(() => {
    const cid = getCompanyId()
    if (cid) {
      apiFetch<Row[]>(`/api/companies/${cid}/pipelines`)
        .then((rows) => setPipelines(rows.map(rowToPipeline)))
        .catch(() => setPipelines(readLS<Pipeline[]>(PIPELINES_KEY, [])))
    } else {
      setPipelines(readLS<Pipeline[]>(PIPELINES_KEY, []))
    }
  }, [])

  const save = useCallback((next: Pipeline[]) => {
    setPipelines(next)
    writeLS(PIPELINES_KEY, next)
  }, [])

  const createPipeline = useCallback(
    async (data: Omit<Pipeline, "id" | "createdAt">): Promise<Pipeline> => {
      const cid = getCompanyId()
      if (cid) {
        const row = await apiFetch<Row>(`/api/companies/${cid}/pipelines`, {
          method: "POST",
          body: JSON.stringify(pipelineToRow(data)),
        })
        const pipeline = rowToPipeline(row)
        setPipelines((prev) => [...prev, pipeline])
        return pipeline
      }
      const pipeline: Pipeline = { ...data, id: uid(), createdAt: new Date().toISOString() }
      save([...readLS<Pipeline[]>(PIPELINES_KEY, []), pipeline])
      return pipeline
    },
    [save]
  )

  const updatePipeline = useCallback(
    async (id: string, data: Partial<Omit<Pipeline, "id" | "createdAt">>) => {
      const cid = getCompanyId()
      if (cid) {
        const row = await apiFetch<Row>(`/api/companies/${cid}/pipelines/${id}`, {
          method: "PATCH",
          body: JSON.stringify(pipelineToRow(data as Omit<Pipeline, "id" | "createdAt">)),
        })
        const updated = rowToPipeline(row)
        setPipelines((prev) => prev.map((p) => (p.id === id ? updated : p)))
        return
      }
      save(readLS<Pipeline[]>(PIPELINES_KEY, []).map((p) => (p.id === id ? { ...p, ...data } : p)))
    },
    [save]
  )

  const deletePipeline = useCallback(
    async (id: string) => {
      const cid = getCompanyId()
      if (cid) {
        await apiFetch(`/api/companies/${cid}/pipelines/${id}`, { method: "DELETE" })
        setPipelines((prev) => prev.filter((p) => p.id !== id))
        return
      }
      save(readLS<Pipeline[]>(PIPELINES_KEY, []).filter((p) => p.id !== id))
    },
    [save]
  )

  return { pipelines, createPipeline, updatePipeline, deletePipeline }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    const cid = getCompanyId()
    if (cid) {
      apiFetch<Row[]>(`/api/companies/${cid}/sessions`)
        .then((rows) => setSessions(rows.map(rowToSession)))
        .catch(() => {
          ensureSeeded()
          setSessions(readLS<Session[]>(SESSIONS_KEY, []))
        })
    } else {
      ensureSeeded()
      setSessions(readLS<Session[]>(SESSIONS_KEY, []))
    }
  }, [])

  const save = useCallback((next: Session[]) => {
    setSessions(next)
    writeLS(SESSIONS_KEY, next)
  }, [])

  const createSession = useCallback(
    async (data: Omit<Session, "id" | "createdAt">): Promise<Session> => {
      const cid = getCompanyId()
      if (cid) {
        const row = await apiFetch<Row>(`/api/companies/${cid}/sessions`, {
          method: "POST",
          body: JSON.stringify({
            name: data.name,
            pipeline_id: data.pipelineId ?? null,
            agent_id: data.agentId ?? null,
            status: data.status,
          }),
        })
        const session = rowToSession(row)
        setSessions((prev) => [session, ...prev])
        return session
      }
      const session: Session = { ...data, id: uid(), createdAt: new Date().toISOString() }
      const next = [...readLS<Session[]>(SESSIONS_KEY, []), session]
      save(next)
      return session
    },
    [save]
  )

  const deleteSession = useCallback(
    async (id: string) => {
      const cid = getCompanyId()
      if (cid) {
        await apiFetch(`/api/companies/${cid}/sessions/${id}`, { method: "DELETE" })
        setSessions((prev) => prev.filter((s) => s.id !== id))
        return
      }
      save(readLS<Session[]>(SESSIONS_KEY, []).filter((s) => s.id !== id))
    },
    [save]
  )

  const appendMessage = useCallback(
    (sessionId: string, message: ChatMessage) => {
      // always update local state immediately for responsive UI
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: [...s.messages, message],
                totalCostUsd: s.totalCostUsd + (message.costUsd ?? 0),
              }
            : s
        )
      )
      // persist to local storage in offline mode
      const cid = getCompanyId()
      if (!cid) {
        writeLS(
          SESSIONS_KEY,
          readLS<Session[]>(SESSIONS_KEY, []).map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: [...s.messages, message],
                  totalCostUsd: s.totalCostUsd + (message.costUsd ?? 0),
                }
              : s
          )
        )
      } else {
        // fire-and-forget to DB (B4 runner will handle this properly)
        apiFetch(`/api/companies/${cid}/sessions/${sessionId}/messages`, {
          method: "POST",
          body: JSON.stringify(messageToRow(message)),
        }).catch(console.error)
      }
    },
    []
  )

  // Trigger a pipeline run via the backend; creates a new session and returns it
  const runPipeline = useCallback(
    async (pipelineId: string, task: string, provider?: string): Promise<Session | null> => {
      const cid = getCompanyId()
      if (!cid) return null
      const run = await apiFetch<{ session_id: string }>(
        `/api/companies/${cid}/pipelines/${pipelineId}/run`,
        { method: "POST", body: JSON.stringify({ task, provider: provider || undefined }) },
      )
      const row = await apiFetch<Row>(`/api/companies/${cid}/sessions/${run.session_id}`)
      const session = rowToSession(row)
      setSessions((prev) => [session, ...prev])
      return session
    },
    []
  )

  // B3 — Single-agent chat: POST user message to backend, LLM responds via WS agent_done
  const agentChat = useCallback(
    async (sessionId: string, content: string, provider?: string): Promise<void> => {
      const cid = getCompanyId()
      if (!cid) return
      await apiFetch(
        `/api/companies/${cid}/sessions/${sessionId}/chat`,
        { method: "POST", body: JSON.stringify({ content, preferred_provider: provider || undefined }) },
      )
    },
    []
  )

  // Fetch latest session (with messages) from API and replace in local state
  const refreshSession = useCallback(async (id: string) => {
    const cid = getCompanyId()
    if (!cid) return
    try {
      const row = await apiFetch<Row>(`/api/companies/${cid}/sessions/${id}`)
      const fresh = rowToSession(row)
      setSessions((prev) => prev.map((s) => s.id === id ? fresh : s))
    } catch {
      // silently ignore — offline or session deleted
    }
  }, [])

  // Update session metadata in local state only (WS-driven status/cost updates)
  const patchSessionLocal = useCallback(
    (sessionId: string, patch: Partial<Pick<Session, "status" | "totalCostUsd">>) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ...patch } : s))
      )
    },
    []
  )

  // Append a message to local state only (no API call — used when backend already persisted it)
  const appendMessageLocal = useCallback(
    (sessionId: string, message: ChatMessage) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: [...s.messages, message],
                totalCostUsd: s.totalCostUsd + (message.costUsd ?? 0),
              }
            : s
        )
      )
    },
    []
  )

  return {
    sessions,
    createSession,
    deleteSession,
    appendMessage,
    runPipeline,
    agentChat,
    refreshSession,
    patchSessionLocal,
    appendMessageLocal,
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    setSettings(readLS<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS))
  }, [])

  const saveSettings = useCallback((next: AppSettings) => {
    setSettings(next)
    writeLS(SETTINGS_KEY, next)
  }, [])

  const updateKey = useCallback(
    (provider: Provider, key: string) => {
      const current = readLS<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
      saveSettings({ ...current, providerKeys: { ...current.providerKeys, [provider]: key } })
    },
    [saveSettings]
  )

  const updateBudget = useCallback(
    (patch: Partial<Pick<AppSettings, "budgetCapUsd" | "alertThresholdPct">>) => {
      saveSettings({ ...readLS<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS), ...patch })
    },
    [saveSettings]
  )

  const updateCompanyId = useCallback(
    (companyId: string) => {
      saveSettings({ ...readLS<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS), companyId })
    },
    [saveSettings]
  )

  return { settings, updateKey, updateBudget, updateCompanyId }
}
