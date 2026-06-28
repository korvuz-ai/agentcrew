# STRUCTURE.md (auto-generated โดย scripts/gen-structure-map.sh — อย่าแก้มือ)

- `frontend/app/dashboard/agents/page.tsx` — Agent management page — grid of agent cards with create/edit/delete
- `frontend/app/dashboard/chat/page.tsx` — chat page — placeholder, built in Phase 4
- `frontend/app/dashboard/history/page.tsx` — history page — placeholder, built in Phase 4
- `frontend/app/dashboard/layout.tsx` — Dashboard shell — sidebar + main content area for all /dashboard/* pages
- `frontend/app/dashboard/library/page.tsx` — Skill library page — catalog of reusable skill cards with create/edit/delete
- `frontend/app/dashboard/org-chart/page.tsx` — Org chart page — shows agents as hierarchy nodes (flat in Phase 2, hierarchy from Phase 3 pipelines)
- `frontend/app/dashboard/page.tsx` — Dashboard home — redirects to agents page (main landing after Phase 2)
- `frontend/app/dashboard/pipelines/page.tsx` — pipelines page — placeholder, built in Phase 3
- `frontend/app/dashboard/settings/page.tsx` — settings page — placeholder, built in Phase 5
- `frontend/app/layout.tsx` — Root layout — global fonts, metadata, base HTML structure
- `frontend/app/page.tsx` — Root page — redirects directly to dashboard (no auth required)
- `frontend/components/agent-card/AgentCard.tsx` — Displays a single agent as a trading-card style tile with level, providers, skills
- `frontend/components/agent-card/AgentDialog.tsx` — Create / edit agent dialog — level picker, provider toggles, skill assignment
- `frontend/components/shared/Sidebar.tsx` — Main navigation sidebar — logo, nav links, phase-gated items
- `frontend/components/skill-card/SkillCard.tsx` — Single skill tile — name, description, category chip, usage count
- `frontend/components/skill-card/SkillDialog.tsx` — Create / edit skill dialog with markdown editor for instructions
- `frontend/lib/store.ts` — Client-side data store using localStorage — swap individual functions with API calls in Phase 3
- `frontend/lib/types.ts` — Shared TypeScript types for agents, skills, and pipelines across the app
