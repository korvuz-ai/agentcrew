// Purpose: Settings page — API key vault per provider + budget cap
// Used by: sidebar navigation (always accessible, no phase gate)

"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Eye, EyeOff, Link, Loader2, XCircle } from "lucide-react"
import { useSettings } from "@/lib/store"
import { apiFetch } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { Provider } from "@/lib/types"

const PROVIDERS: { id: Provider; label: string; color: string; placeholder: string }[] = [
  { id: "claude", label: "Claude",  color: "text-violet-700",   placeholder: "sk-ant-api03-…" },
  { id: "gemini", label: "Gemini",  color: "text-blue-700",     placeholder: "AIza…" },
  { id: "gpt",    label: "GPT",     color: "text-emerald-700",  placeholder: "sk-proj-…" },
]

function maskKey(key: string) {
  if (key.length <= 8) return "••••••••"
  return key.slice(0, 8) + "••••" + key.slice(-4)
}

type ApiKeyStatus = { hasKey: boolean; updatedAt?: string } | null
type TestResult = { ok: boolean; latencyMs?: number; error?: string } | null

export default function SettingsPage() {
  const { settings, updateKey, updateBudget, updateCompanyId } = useSettings()
  const isApiMode = !!settings.companyId

  // localStorage mode state
  const [showKey, setShowKey]     = useState<Record<Provider, boolean>>({ claude: false, gemini: false, gpt: false })

  // API mode state
  const [apiStatus, setApiStatus] = useState<Record<Provider, ApiKeyStatus>>({ claude: null, gemini: null, gpt: null })
  const [testResult, setTestResult] = useState<Record<Provider, TestResult>>({ claude: null, gemini: null, gpt: null })
  const [isTesting, setIsTesting] = useState<Provider | null>(null)
  const [isSaving, setIsSaving]   = useState<Provider | null>(null)

  // Shared editing state
  const [editing, setEditing]     = useState<Provider | null>(null)
  const [keyInput, setKeyInput]   = useState("")

  // Company ID editing
  const [companyInput, setCompanyInput] = useState("")
  const [editingCompany, setEditingCompany] = useState(false)

  // Budget editing (API mode saves to backend; localStorage mode saves locally)
  const [budgetEditing, setBudgetEditing] = useState(false)
  const [budgetInput, setBudgetInput] = useState({ cap: 0, threshold: 80 })
  const [isSavingBudget, setIsSavingBudget] = useState(false)

  // Fetch vault key statuses + budget when in API mode
  useEffect(() => {
    if (!settings.companyId) return
    const cid = settings.companyId

    PROVIDERS.forEach(async ({ id }) => {
      try {
        const r = await apiFetch<{ has_key: boolean; updated_at?: string }>(
          `/api/companies/${cid}/api-keys/${id}`
        )
        setApiStatus(prev => ({ ...prev, [id]: { hasKey: r.has_key, updatedAt: r.updated_at } }))
      } catch {
        // backend might not be reachable yet
      }
    })

    // Load current budget from backend
    apiFetch<{ budget_cap_usd: number; alert_threshold_pct: number }>(`/api/companies/${cid}`)
      .then(r => {
        updateBudget({ budgetCapUsd: r.budget_cap_usd, alertThresholdPct: r.alert_threshold_pct })
      })
      .catch(() => {})
  }, [settings.companyId, updateBudget])

  function startEdit(provider: Provider) {
    setEditing(provider)
    setKeyInput(isApiMode ? "" : (settings.providerKeys[provider] ?? ""))
    setTestResult(prev => ({ ...prev, [provider]: null }))
  }

  async function saveKey() {
    if (!editing) return
    const key = keyInput.trim()

    if (isApiMode) {
      setIsSaving(editing)
      try {
        const r = await apiFetch<{ has_key: boolean; updated_at?: string }>(
          `/api/companies/${settings.companyId}/api-keys/${editing}`,
          { method: "PUT", body: JSON.stringify({ key }) },
        )
        setApiStatus(prev => ({ ...prev, [editing!]: { hasKey: r.has_key, updatedAt: r.updated_at } }))
      } catch (e) {
        alert(`Failed to save key: ${e}`)
      } finally {
        setIsSaving(null)
      }
    } else {
      updateKey(editing, key)
    }

    setEditing(null)
    setKeyInput("")
  }

  function cancelEdit() {
    setEditing(null)
    setKeyInput("")
  }

  async function testKey(provider: Provider) {
    if (!isApiMode) return
    setIsTesting(provider)
    setTestResult(prev => ({ ...prev, [provider]: null }))
    try {
      const r = await apiFetch<{ ok: boolean; latency_ms?: number; error?: string }>(
        `/api/companies/${settings.companyId}/api-keys/${provider}/test`
      )
      setTestResult(prev => ({ ...prev, [provider]: { ok: r.ok, latencyMs: r.latency_ms, error: r.error } }))
    } catch (e) {
      setTestResult(prev => ({ ...prev, [provider]: { ok: false, error: String(e) } }))
    } finally {
      setIsTesting(null)
    }
  }

  async function deleteKey(provider: Provider) {
    if (!isApiMode) return
    try {
      await apiFetch(`/api/companies/${settings.companyId}/api-keys/${provider}`, { method: "DELETE" })
      setApiStatus(prev => ({ ...prev, [provider]: { hasKey: false } }))
      setTestResult(prev => ({ ...prev, [provider]: null }))
    } catch (e) {
      alert(`Failed to delete key: ${e}`)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">API keys and budget configuration</p>
      </div>

      {/* ── Backend Connection ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Backend Connection</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Set your Company ID (UUID) to enable backend mode. Keys are then encrypted at rest (Fernet).
          </p>
        </div>

        <div className="rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Link className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              {editingCompany ? (
                <Input
                  autoFocus
                  value={companyInput}
                  onChange={(e) => setCompanyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { updateCompanyId(companyInput.trim()); setEditingCompany(false) }
                    if (e.key === "Escape") setEditingCompany(false)
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="font-mono text-xs"
                />
              ) : (
                <p className="font-mono text-xs text-muted-foreground">
                  {settings.companyId
                    ? <span className="flex items-center gap-1.5 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" />{settings.companyId}</span>
                    : <span className="italic">Not set — using localStorage mode</span>
                  }
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {editingCompany ? (
                <>
                  <Button size="sm" onClick={() => { updateCompanyId(companyInput.trim()); setEditingCompany(false) }}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingCompany(false)}>Cancel</Button>
                </>
              ) : (
                <button
                  onClick={() => { setCompanyInput(settings.companyId ?? ""); setEditingCompany(true) }}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {settings.companyId ? "Change" : "Set ID"}
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Find your Company ID: <code className="font-mono">SELECT id FROM companies;</code>
          </p>
        </div>
      </section>

      {/* ── API Keys ──────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">API Keys</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isApiMode
              ? "🔒 Stored encrypted (Fernet) in the backend vault — plaintext never leaves the server."
              : "Stored locally in this browser. Set a Company ID above to enable the encrypted vault."}
          </p>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {PROVIDERS.map(({ id, label, color, placeholder }) => {
            const isEditing  = editing === id
            const isSavingMe = isSaving === id
            const isTestingMe = isTesting === id
            const test = testResult[id]

            // Determine "has key" and display text per mode
            const hasKey = isApiMode
              ? (apiStatus[id]?.hasKey ?? false)
              : !!settings.providerKeys[id]

            return (
              <div key={id} className="flex items-start gap-4 px-4 py-4">
                <span className={`mt-0.5 w-16 shrink-0 text-sm font-bold ${color}`}>{label}</span>

                <div className="flex-1 space-y-1.5">
                  {isEditing ? (
                    <Input
                      autoFocus
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveKey()}
                      placeholder={placeholder}
                      className="font-mono text-xs"
                    />
                  ) : (
                    <p className="font-mono text-xs text-muted-foreground">
                      {hasKey
                        ? isApiMode
                          ? <span className="text-foreground/70">Encrypted in vault</span>
                          : (showKey[id] ? settings.providerKeys[id] : maskKey(settings.providerKeys[id]))
                        : <span className="italic">Not set</span>
                      }
                    </p>
                  )}

                  {/* Test result */}
                  {test && (
                    <p className={`flex items-center gap-1 text-[11px] ${test.ok ? "text-green-700" : "text-red-600"}`}>
                      {test.ok
                        ? <><CheckCircle2 className="h-3 w-3" />Connected · {test.latencyMs}ms</>
                        : <><XCircle className="h-3 w-3" />{test.error ?? "Connection failed"}</>
                      }
                    </p>
                  )}
                </div>

                {/* Status chip */}
                {!isEditing && (
                  <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    hasKey
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-border bg-muted text-muted-foreground"
                  }`}>
                    {hasKey ? "Connected" : "Not set"}
                  </span>
                )}

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={saveKey} disabled={!keyInput.trim() || isSavingMe}>
                        {isSavingMe ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      {/* Show/hide (localStorage mode only) */}
                      {!isApiMode && hasKey && (
                        <button
                          onClick={() => setShowKey(s => ({ ...s, [id]: !s[id] }))}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                        >
                          {showKey[id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}

                      <button
                        onClick={() => startEdit(id)}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        {hasKey ? "Update" : "Add key"}
                      </button>

                      {/* Test (API mode only) */}
                      {isApiMode && hasKey && (
                        <button
                          onClick={() => testKey(id)}
                          disabled={isTestingMe}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                        >
                          {isTestingMe ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
                        </button>
                      )}

                      {/* Delete (API mode only) */}
                      {isApiMode && hasKey && (
                        <button
                          onClick={() => deleteKey(id)}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {isApiMode && (
          <p className="text-[10px] text-muted-foreground/50">
            Keys stored in DB are used automatically by the pipeline runner — no need to set env vars.
          </p>
        )}
      </section>

      {/* ── Budget Cap ────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Budget Cap</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Prevent runaway agent costs per company per month</p>
        </div>

        <div className="space-y-4 rounded-xl border border-border p-5">
          {budgetEditing ? (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label>Monthly spend limit</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    autoFocus
                    min={0}
                    step={5}
                    value={budgetInput.cap}
                    onChange={(e) => setBudgetInput(b => ({ ...b, cap: parseFloat(e.target.value) || 0 }))}
                    className="max-w-[110px]"
                  />
                  <span className="text-sm text-muted-foreground">USD</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Alert threshold</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={budgetInput.threshold}
                    onChange={(e) => setBudgetInput(b => ({ ...b, threshold: parseInt(e.target.value) || 0 }))}
                    className="max-w-[80px]"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Alert at <span className="font-mono">${((budgetInput.cap * budgetInput.threshold) / 100).toFixed(2)}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Monthly cap</p>
                <p className="font-mono font-semibold text-foreground">
                  {settings.budgetCapUsd > 0 ? `$${settings.budgetCapUsd.toFixed(2)}` : "Unlimited"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Alert threshold</p>
                <p className="font-mono font-semibold text-foreground">
                  {settings.alertThresholdPct}%
                  {settings.budgetCapUsd > 0 && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (${((settings.budgetCapUsd * settings.alertThresholdPct) / 100).toFixed(2)})
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-muted-foreground/50">
              {isApiMode ? "Enforced server-side." : "Client-side only — set Company ID to enforce server-side."}
            </p>
            <div className="flex gap-1">
              {budgetEditing ? (
                <>
                  <Button
                    size="sm"
                    disabled={isSavingBudget}
                    onClick={async () => {
                      const patch = { budgetCapUsd: budgetInput.cap, alertThresholdPct: budgetInput.threshold }
                      if (isApiMode) {
                        setIsSavingBudget(true)
                        try {
                          await apiFetch(`/api/companies/${settings.companyId}`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              budget_cap_usd: budgetInput.cap,
                              alert_threshold_pct: budgetInput.threshold,
                            }),
                          })
                        } catch (e) {
                          alert(`Failed to save budget: ${e}`)
                        } finally {
                          setIsSavingBudget(false)
                        }
                      }
                      updateBudget(patch)
                      setBudgetEditing(false)
                    }}
                  >
                    {isSavingBudget ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBudgetEditing(false)}>Cancel</Button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setBudgetInput({ cap: settings.budgetCapUsd, threshold: settings.alertThresholdPct })
                    setBudgetEditing(true)
                  }}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
    </div>
  )
}
