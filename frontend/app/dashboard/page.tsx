// Purpose: Dashboard home — redirects to agents page (main landing after Phase 2)
// Used by: root redirect, sidebar fallback

import { redirect } from "next/navigation"

export default function DashboardPage() {
  redirect("/dashboard/agents")
}
