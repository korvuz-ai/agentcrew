// Purpose: Dashboard shell — sidebar + main content area for all /dashboard/* pages
// Used by: all pages under app/dashboard/

import { Sidebar } from "@/components/shared/Sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
