// Purpose: Main navigation sidebar — logo, nav links, phase-gated items
// Used by: app/dashboard/layout.tsx

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bot,
  Building2,
  History,
  LayoutGrid,
  MessageSquare,
  Settings,
  Sofa,
  Workflow,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard/org-chart",  label: "Org Chart",  icon: Building2,     phase: 2 },
  { href: "/dashboard/library",    label: "Library",    icon: LayoutGrid,    phase: 2 },
  { href: "/dashboard/agents",     label: "Agents",     icon: Bot,           phase: 2 },
  { href: "/dashboard/pipelines",  label: "Pipelines",  icon: Workflow,      phase: 3 },
  { href: "/dashboard/chat",       label: "Chat",       icon: MessageSquare, phase: 4 },
  { href: "/dashboard/history",    label: "History",    icon: History,       phase: 5 },
  { href: "/dashboard/office",     label: "Office",     icon: Sofa,          phase: 6 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 border-b border-border">
        <span className="font-mono text-sm font-semibold text-foreground">korvuz.exe</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, phase }) => {
          const active = pathname.startsWith(href)
          const locked = phase > 6
          return (
            <Link
              key={href}
              href={locked ? "#" : href}
              aria-disabled={locked}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                locked
                  ? "cursor-not-allowed text-muted-foreground/40"
                  : active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {locked && (
                <span className="ml-auto text-[10px] text-muted-foreground/40">soon</span>
              )}
            </Link>
          )
        })}
      </nav>

      <Separator className="mx-3" />

      <div className="px-2 py-3">
        <Link
          href="/dashboard/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname.startsWith("/dashboard/settings")
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
