// Purpose: Dashboard home — placeholder until Phase 2 agents page is built
// Used by: middleware redirect after org selection, sidebar "home" fallback

import { redirect } from "next/navigation"

export default function DashboardPage() {
  // Phase 2 will redirect to /dashboard/agents once that page exists
  redirect("/dashboard/agents")
}
