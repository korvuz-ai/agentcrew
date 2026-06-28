// Purpose: Dashboard shell — sidebar + main content area for all /dashboard/* pages
// Used by: all pages under app/dashboard/

import dynamic from "next/dynamic"

// Sidebar uses Clerk hooks — load client-only to avoid prerender errors when Clerk is unconfigured
const Sidebar = dynamic(() => import("@/components/shared/Sidebar").then((m) => m.Sidebar), {
  ssr: false,
})

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
