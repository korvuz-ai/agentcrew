// Purpose: Dashboard shell — sidebar + main content area for all /dashboard/* pages
// Used by: all pages under app/dashboard/

import { Sidebar } from "@/components/shared/Sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  )
}
