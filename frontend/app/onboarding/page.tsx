// Purpose: Onboarding screen — create or select a Clerk Organization (= company) after first login
// Used by: middleware (redirect when userId exists but orgId is null)

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, ChevronRight, Loader2, Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Mode = "pick" | "create" | "select"

// Stub types — replaced by real Clerk data when ClerkProvider is present
type OrgMembership = { organization: { id: string; name: string }; role: string }

// Lazy-load Clerk hooks so the page renders without ClerkProvider
function useClerkOrgs() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useOrganizationList } = require("@clerk/nextjs")
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useOrganizationList({ userMemberships: { infinite: true } }) as {
      isLoaded: boolean
      setActive?: (v: { organization: string }) => Promise<void>
      createOrganization?: (v: { name: string }) => Promise<{ id: string }>
      userMemberships?: { data: OrgMembership[] }
    }
  } catch {
    return { isLoaded: true, setActive: undefined, createOrganization: undefined, userMemberships: undefined }
  }
}

export default function OnboardingPage() {
  const [mode, setMode] = useState<Mode>("pick")
  const [companyName, setCompanyName] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const { isLoaded, setActive, createOrganization, userMemberships } = useClerkOrgs()
  const companies: OrgMembership[] = userMemberships?.data ?? []

  async function handleCreate() {
    if (!companyName.trim()) return
    setLoading(true)
    try {
      if (createOrganization && setActive) {
        const org = await createOrganization({ name: companyName.trim() })
        await setActive({ organization: org.id })
      }
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(orgId: string) {
    setLoading(true)
    try {
      if (setActive) await setActive({ organization: orgId })
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center border-b border-border px-6">
        <span className="font-mono text-sm font-semibold text-foreground">korvuz.exe</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        {!isLoaded ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            {mode === "pick" && (
              <PickMode
                companyCount={companies.length}
                onCreateClick={() => setMode("create")}
                onSelectClick={() => setMode("select")}
              />
            )}
            {mode === "create" && (
              <CreateMode
                value={companyName}
                loading={loading}
                onChange={setCompanyName}
                onBack={() => setMode("pick")}
                onSubmit={handleCreate}
              />
            )}
            {mode === "select" && (
              <SelectMode
                companies={companies}
                loading={loading}
                onBack={() => setMode("pick")}
                onSelect={handleSelect}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function PickMode({
  companyCount,
  onCreateClick,
  onSelectClick,
}: {
  companyCount: number
  onCreateClick: () => void
  onSelectClick: () => void
}) {
  return (
    <div className="w-full max-w-2xl">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome to korvuz.exe</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose how you want to get started.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={onCreateClick}
          className="group flex flex-col items-center gap-5 rounded-xl border-2 border-border bg-card px-8 py-10 transition hover:border-primary/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-dashed border-border group-hover:border-primary/60 transition-colors">
            <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Create a new company</p>
            <p className="mt-1 text-sm text-muted-foreground">Start a fresh AI workforce</p>
          </div>
          <ChevronRight className="mt-auto h-4 w-4 text-muted-foreground/50 group-hover:text-primary/60 transition-colors" />
        </button>

        <button
          onClick={companyCount > 0 ? onSelectClick : undefined}
          disabled={companyCount === 0}
          className={`group flex flex-col items-center gap-5 rounded-xl border-2 px-8 py-10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            companyCount > 0
              ? "border-border bg-card hover:border-primary/60 hover:shadow-sm cursor-pointer"
              : "border-border/50 bg-muted cursor-not-allowed opacity-50"
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary group-hover:bg-accent/30 transition-colors">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Select an existing company</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {companyCount > 0 ? "Continue where you left off" : "No companies yet"}
            </p>
          </div>
          {companyCount > 0 && (
            <Badge variant="secondary" className="mt-auto text-xs">
              {companyCount} {companyCount === 1 ? "company" : "companies"}
            </Badge>
          )}
        </button>
      </div>
    </div>
  )
}

function CreateMode({
  value,
  loading,
  onChange,
  onBack,
  onSubmit,
}: {
  value: string
  loading: boolean
  onChange: (v: string) => void
  onBack: () => void
  onSubmit: () => void
}) {
  return (
    <div className="w-full max-w-md">
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" /> Back
      </button>

      <h1 className="mb-1 text-xl font-semibold text-foreground">Create your company</h1>
      <p className="mb-8 text-sm text-muted-foreground">Give your AI workforce a name to get started.</p>

      <label className="block text-sm font-medium text-foreground">Company name</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && value.trim() && onSubmit()}
        placeholder="e.g. Acme AI Corp"
        autoFocus
        className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <Button disabled={!value.trim() || loading} className="mt-6 w-full" onClick={onSubmit}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create company
      </Button>
    </div>
  )
}

function SelectMode({
  companies,
  loading,
  onBack,
  onSelect,
}: {
  companies: OrgMembership[]
  loading: boolean
  onBack: () => void
  onSelect: (orgId: string) => void
}) {
  return (
    <div className="w-full max-w-md">
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" /> Back
      </button>

      <h1 className="mb-1 text-xl font-semibold text-foreground">Your companies</h1>
      <p className="mb-8 text-sm text-muted-foreground">Select a company to continue.</p>

      <div className="space-y-2">
        {companies.map((m) => (
          <button
            key={m.organization.id}
            disabled={loading}
            className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition hover:border-primary/50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            onClick={() => onSelect(m.organization.id)}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="flex-1 truncate text-sm font-medium text-foreground">
              {m.organization.name}
            </span>
            <Badge variant="secondary" className="shrink-0 text-xs capitalize">{m.role}</Badge>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  )
}
