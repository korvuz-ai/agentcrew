// Purpose: Root page — redirects to /onboarding (Clerk auth redirect will override this in Phase 1)
// Used by: Next.js App Router entry point

import { redirect } from "next/navigation"

export default function RootPage() {
  redirect("/onboarding")
}
