// Purpose: Demo seed data — loads a full example team + skills into localStorage
// Used by: app/dashboard/agents/page.tsx (empty-state "Load demo" button)

import type { Agent, Skill } from "./types"

function uid() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export function buildDemoTeam(): { agents: Agent[]; skills: Skill[] } {
  const s_research: Skill = {
    id: uid(), name: "Web Research", category: "Research",
    description: "Search the web and synthesize information from multiple sources",
    instructions: `## Web Research\n\n- Use search to find up-to-date information\n- Cross-reference at least 3 sources\n- Summarize findings in bullet points\n- Always cite sources with URLs`,
    createdAt: new Date().toISOString(),
  }
  const s_code: Skill = {
    id: uid(), name: "Code Review", category: "Engineering",
    description: "Review code for bugs, performance, and best practices",
    instructions: `## Code Review\n\n- Check for logical bugs and edge cases\n- Identify performance bottlenecks\n- Suggest refactors for readability\n- Output: summary + line-by-line comments`,
    createdAt: new Date().toISOString(),
  }
  const s_write: Skill = {
    id: uid(), name: "SEO Writing", category: "Content",
    description: "Write search-optimized content with clear structure and CTAs",
    instructions: `## SEO Writing\n\n- Use H1/H2/H3 structure\n- Include target keyword naturally 3-5x\n- Write compelling meta description\n- Add clear call-to-action at end`,
    createdAt: new Date().toISOString(),
  }
  const s_data: Skill = {
    id: uid(), name: "Data Analysis", category: "Analytics",
    description: "Analyze datasets, identify trends, and write executive summaries",
    instructions: `## Data Analysis\n\n- Identify key metrics and trends\n- Flag anomalies or outliers\n- Produce 3-5 bullet executive summary\n- Suggest next actions based on data`,
    createdAt: new Date().toISOString(),
  }
  const s_plan: Skill = {
    id: uid(), name: "Project Planning", category: "Management",
    description: "Break goals into tasks, estimate timelines, assign priorities",
    instructions: `## Project Planning\n\n- Decompose goal into atomic tasks\n- Assign priority: P0/P1/P2\n- Estimate effort in hours\n- Identify blockers and dependencies`,
    createdAt: new Date().toISOString(),
  }

  const now = new Date().toISOString()

  const agents: Agent[] = [
    {
      id: uid(), avatar: "CEO-Fi.png", name: "Alex", role: "Research Lead",
      backstory: "Senior analyst with 10 years experience. Methodical, cites everything, loves going deep on a topic before forming opinions.",
      level: 3, providers: ["claude"], skillIds: [s_research.id, s_data.id],
      systemPromptOverride: "", createdAt: now,
    },
    {
      id: uid(), avatar: "Content-SEO-Writer.png", name: "Sam", role: "Content Strategist",
      backstory: "Former journalist turned content marketer. Knows how to make complex topics accessible. Always thinks about the reader first.",
      level: 2, providers: ["claude", "gemini"], skillIds: [s_write.id, s_research.id],
      systemPromptOverride: "", createdAt: now,
    },
    {
      id: uid(), avatar: "Lead-Developer.png", name: "Jordan", role: "Senior Engineer",
      backstory: "Full-stack dev who cares deeply about clean code and pragmatic solutions. Speaks plainly and hates over-engineering.",
      level: 3, providers: ["claude", "gpt"], skillIds: [s_code.id],
      systemPromptOverride: "", createdAt: now,
    },
    {
      id: uid(), avatar: "CFO.png", name: "Kai", role: "Data Analyst",
      backstory: "Numbers person who translates raw data into business decisions. Prefers Markdown tables and bullet summaries over long prose.",
      level: 2, providers: ["gemini"], skillIds: [s_data.id, s_plan.id],
      systemPromptOverride: "", createdAt: now,
    },
    {
      id: uid(), avatar: "Marketing-Manager.png", name: "Morgan", role: "Project Manager",
      backstory: "Keeps the team on track. Breaks big goals into clear tasks, flags risks early, and always asks 'what's the next action?'",
      level: 1, providers: ["claude"], skillIds: [s_plan.id],
      systemPromptOverride: "", createdAt: now,
    },
  ]

  return { agents, skills: [s_research, s_code, s_write, s_data, s_plan] }
}
