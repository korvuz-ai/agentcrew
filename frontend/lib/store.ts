// Purpose: Client-side data store using localStorage — swap individual functions with API calls in Phase 3
// Used by: all dashboard pages that read/write agents and skills

"use client"

import { useEffect, useState, useCallback } from "react"
import type { Agent, Skill } from "./types"
import { buildDemoTeam } from "./seeds"

// Bump this string whenever seeds change — forces a re-seed on next load
const SEED_VERSION = "v4"
const SEED_VER_KEY = "korvuz:seed-version"
const AGENTS_KEY   = "korvuz:agents"
const SKILLS_KEY   = "korvuz:skills"

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

// Auto-seed if version mismatch — returns true when seed was applied
function ensureSeeded(): boolean {
  if (typeof window === "undefined") return false
  if (localStorage.getItem(SEED_VER_KEY) === SEED_VERSION) return false
  const { agents, skills } = buildDemoTeam()
  writeLS(AGENTS_KEY, agents)
  writeLS(SKILLS_KEY, skills)
  localStorage.setItem(SEED_VER_KEY, SEED_VERSION)
  return true
}

// ── Agents ────────────────────────────────────────────────────────────────────

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    ensureSeeded()
    setAgents(readLS<Agent[]>(AGENTS_KEY, []))
  }, [])

  const save = useCallback((next: Agent[]) => {
    setAgents(next)
    writeLS(AGENTS_KEY, next)
  }, [])

  const createAgent = useCallback(
    (data: Omit<Agent, "id" | "createdAt">) => {
      const agent: Agent = { ...data, id: uid(), createdAt: new Date().toISOString() }
      save([...readLS<Agent[]>(AGENTS_KEY, []), agent])
      return agent
    },
    [save]
  )

  const updateAgent = useCallback(
    (id: string, data: Partial<Omit<Agent, "id" | "createdAt">>) => {
      save(readLS<Agent[]>(AGENTS_KEY, []).map((a) => (a.id === id ? { ...a, ...data } : a)))
    },
    [save]
  )

  const deleteAgent = useCallback(
    (id: string) => {
      save(readLS<Agent[]>(AGENTS_KEY, []).filter((a) => a.id !== id))
    },
    [save]
  )

  const resetToDemo = useCallback(() => {
    const { agents: a, skills: s } = buildDemoTeam()
    writeLS(AGENTS_KEY, a)
    writeLS(SKILLS_KEY, s)
    localStorage.setItem(SEED_VER_KEY, SEED_VERSION)
    setAgents(a)
  }, [])

  return { agents, createAgent, updateAgent, deleteAgent, resetToDemo }
}

// ── Skills ────────────────────────────────────────────────────────────────────

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([])

  useEffect(() => {
    // ensureSeeded already ran in useAgents (same render cycle), just read
    setSkills(readLS<Skill[]>(SKILLS_KEY, []))
  }, [])

  const save = useCallback((next: Skill[]) => {
    setSkills(next)
    writeLS(SKILLS_KEY, next)
  }, [])

  const createSkill = useCallback(
    (data: Omit<Skill, "id" | "createdAt">) => {
      const skill: Skill = { ...data, id: uid(), createdAt: new Date().toISOString() }
      save([...readLS<Skill[]>(SKILLS_KEY, []), skill])
      return skill
    },
    [save]
  )

  const updateSkill = useCallback(
    (id: string, data: Partial<Omit<Skill, "id" | "createdAt">>) => {
      save(readLS<Skill[]>(SKILLS_KEY, []).map((s) => (s.id === id ? { ...s, ...data } : s)))
    },
    [save]
  )

  const deleteSkill = useCallback(
    (id: string) => {
      save(readLS<Skill[]>(SKILLS_KEY, []).filter((s) => s.id !== id))
    },
    [save]
  )

  return { skills, createSkill, updateSkill, deleteSkill }
}
