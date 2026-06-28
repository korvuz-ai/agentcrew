// Purpose: Root page — redirects directly to dashboard (no auth required)
// Used by: Next.js App Router entry point

import { redirect } from "next/navigation"

export default function RootPage() {
  redirect("/dashboard")
}
