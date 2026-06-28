# STRUCTURE.md (auto-generated โดย scripts/gen-structure-map.sh — อย่าแก้มือ)

- `frontend/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — Clerk-hosted sign-in page, styled to match earth tone theme
- `frontend/app/(auth)/sign-up/[[...sign-up]]/page.tsx` — Clerk-hosted sign-up page, styled to match earth tone theme
- `frontend/app/dashboard/agents/page.tsx` — agents page — placeholder, built in Phase 2
- `frontend/app/dashboard/chat/page.tsx` — chat page — placeholder, built in Phase 4
- `frontend/app/dashboard/history/page.tsx` — history page — placeholder, built in Phase 4
- `frontend/app/dashboard/layout.tsx` — Dashboard shell — sidebar + main content area for all /dashboard/* pages
- `frontend/app/dashboard/library/page.tsx` — library page — placeholder, built in Phase 2
- `frontend/app/dashboard/org-chart/page.tsx` — org-chart page — placeholder, built in Phase 2
- `frontend/app/dashboard/page.tsx` — Dashboard home — placeholder until Phase 2 agents page is built
- `frontend/app/dashboard/pipelines/page.tsx` — pipelines page — placeholder, built in Phase 3
- `frontend/app/dashboard/settings/page.tsx` — settings page — placeholder, built in Phase 5
- `frontend/app/layout.tsx` — Root layout — ClerkProvider (when key is set), global fonts, base HTML structure
- `frontend/app/onboarding/page.tsx` — Onboarding screen — create or select a Clerk Organization (= company) after first login
- `frontend/app/page.tsx` — Root page — redirects to /onboarding (Clerk auth redirect will override this in Phase 1)
- `frontend/components/shared/CompanySwitcher.tsx` — Dropdown to switch between Clerk organizations (= companies)
- `frontend/components/shared/Sidebar.tsx` — Main navigation sidebar — logo, company switcher, nav links, user menu
- `frontend/middleware.ts` — Route protection — redirects unauthenticated users; skipped when Clerk keys are not set
