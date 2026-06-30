// Thin fetch wrapper — all routes go through /api/* (proxied to FastAPI via Next.js rewrites)

export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...((options?.headers as Record<string, string>) ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`API ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface FileUploadResult {
  filename: string
  object_path: string
  download_url: string
  size_bytes: number
  content_type: string
}

export async function uploadFile(
  companyId: string,
  sessionId: string,
  file: File,
): Promise<FileUploadResult> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(
    `/api/companies/${companyId}/sessions/${sessionId}/files`,
    { method: "POST", body: form },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Upload failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<FileUploadResult>
}
