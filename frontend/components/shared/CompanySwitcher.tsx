// Purpose: Dropdown to switch between Clerk organizations (= companies)
// Used by: components/shared/Sidebar.tsx

"use client"

import { useOrganization, useOrganizationList } from "@clerk/nextjs"
import { Building2, Check, ChevronDown, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function CompanySwitcher() {
  const router = useRouter()
  const { organization } = useOrganization()
  const { userMemberships, setActive } = useOrganizationList({ userMemberships: true })

  const companies = userMemberships?.data ?? []

  async function switchTo(orgId: string) {
    if (!setActive || orgId === organization?.id) return
    await setActive({ organization: orgId })
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted focus:outline-none">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/15">
          <Building2 className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="flex-1 truncate font-medium text-foreground">
          {organization?.name ?? "Select company"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52">
        {companies.map((m) => (
          <DropdownMenuItem
            key={m.organization.id}
            onClick={() => switchTo(m.organization.id)}
            className="flex items-center gap-2"
          >
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 truncate">{m.organization.name}</span>
            {m.organization.id === organization?.id && (
              <Check className="h-3.5 w-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push("/onboarding")}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add company
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
