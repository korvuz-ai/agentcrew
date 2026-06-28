# korvuz.exe

แพลตฟอร์มสร้างและบริหาร "บริษัท AI agent" — ผู้ใช้สร้าง agent เป็นการ์ดเกม (level = LLM tier), ผูก skill จาก library, จัดเป็น pipeline, คุยงานผ่านแชทที่เห็น agent คุยกันแบบ real-time พร้อม token/cost/time ทุก step

**Live:** https://agents.korvuz.site

---

## Tech Stack

| Layer | เลือกใช้ | เหตุผล |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | App Router ที่ใช้ใน InvoiceAI |
| Styling | Tailwind CSS v3 + shadcn/ui | component library สำเร็จรูป |
| Theme | Earth tone (cream/terracotta/sand) | — |
| Auth | Clerk + Clerk Organizations | Organizations = company ในตัว |
| Backend | FastAPI (Python) | ต้องอยู่ runtime เดียวกับ CrewAI |
| Agent layer | CrewAI | Role-based, รองรับ hierarchical + sequential |
| LLM routing | LiteLLM (ผ่าน CrewAI) | รองรับ Claude/Gemini/GPT ใน call เดียว |
| DB | PostgreSQL + SQLAlchemy + Alembic | relational model สำหรับ company/agent/skill |
| Cache/Queue | Redis | session, rate-limit, pipeline run queue |
| File storage | MinIO (self-host) | S3-compatible ไม่ผูก cloud |
| Realtime | WebSocket (FastAPI native) | broadcast agent trace events |
| Deploy | Docker Compose + Nginx (VPS) | ใช้ VPS เดิมกับ InvoiceAI |

---

## Architecture

```
[Next.js Frontend] ──REST──▶ [FastAPI Backend] ──▶ [CrewAI + LiteLLM] ──▶ [Claude/Gemini/GPT]
        │                           │                        │
        └──────WebSocket────────────┘                        ▼
    (agent trace live)                            [PostgreSQL / Redis / MinIO]
```

### Nginx routing (VPS)
```
agents.korvuz.site      → frontend container  (port 8790 → 3000)
agents.korvuz.site/api  → backend container   (port 8791 → 8000)  [Phase 3]
```

### WebSocket events (ใช้ schema เดียวทั้ง chat view และ office view)
```json
{ "type": "agent_start",   "agent": "researcher", "step": 1 }
{ "type": "agent_thought", "agent": "researcher", "text": "..." }
{ "type": "agent_done",    "agent": "researcher", "usage": { "tokens": 1200, "cost": 0.004, "ms": 2300 } }
{ "type": "pipeline_done", "final_output": "...", "total_cost": 0.021 }
```

---

## Project Structure

```
agent-company/
├── frontend/                          Next.js 14 app
│   ├── app/
│   │   ├── (auth)/                    Clerk sign-in/sign-up (catch-all routes)
│   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │   ├── dashboard/                 Protected pages (requires auth + org)
│   │   │   ├── layout.tsx             Shell: Sidebar + main area
│   │   │   ├── page.tsx              → redirect /dashboard/agents
│   │   │   ├── org-chart/page.tsx     [Phase 2]
│   │   │   ├── library/page.tsx       [Phase 2]
│   │   │   ├── agents/page.tsx        [Phase 2]
│   │   │   ├── pipelines/page.tsx     [Phase 3]
│   │   │   ├── chat/page.tsx          [Phase 4]
│   │   │   ├── history/page.tsx       [Phase 5]
│   │   │   └── settings/page.tsx      [Phase 5]
│   │   ├── onboarding/page.tsx        Create/Select company (Clerk Org)
│   │   ├── layout.tsx                 Root: ClerkProvider (conditional)
│   │   └── page.tsx                  → redirect /onboarding
│   ├── components/
│   │   ├── shared/
│   │   │   ├── Sidebar.tsx            Nav sidebar (earth tone, korvuz.exe logo)
│   │   │   ├── CompanySwitcher.tsx    Clerk org switcher dropdown
│   │   │   └── ClerkErrorBoundary.tsx Error boundary: graceful fallback ถ้า Clerk ไม่ configured
│   │   └── ui/                        shadcn/ui components (auto-generated)
│   ├── lib/
│   │   └── utils.ts                   cn() helper (clsx + tailwind-merge)
│   ├── public/
│   │   └── agents/                    Agent avatar images (*.png)
│   ├── middleware.ts                   Route protection (Clerk, skips if no key)
│   ├── next.config.mjs                output: standalone (Docker-optimized)
│   ├── tailwind.config.ts             Earth tone CSS vars → Tailwind tokens
│   ├── Dockerfile                     Multi-stage: deps → builder → runner
│   └── .dockerignore
├── docker-compose.yml                 Frontend service on 127.0.0.1:8790
├── .env.example                       Template สำหรับ Clerk + future services
├── .gitignore
├── CLAUDE.md                          Context สำหรับ Claude Code
├── CONVENTIONS.md                     กฎ naming + header comments
├── STRUCTURE.md                       Auto-generated file index (Purpose per file)
├── TASKS.md                           Phase-based task list
└── README.md                          (ไฟล์นี้)
```

---

## Setup

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (สำหรับ local dev)
- Clerk account (https://dashboard.clerk.com)

### 1. Clone
```bash
git clone https://github.com/korvuz-ai/korvuz-exe.git
cd korvuz-exe
```

### 2. ตั้งค่า Environment
```bash
cp .env.example .env
# แก้ .env ใส่ Clerk keys (ดูหัวข้อ Environment Variables ด้านล่าง)
```

### 3. Build + Run
```bash
docker compose build
docker compose up -d
```

### 4. Local development (ไม่ใช้ Docker)
```bash
cd frontend
cp ../.env.example .env.local   # แก้ key
npm install
npm run dev                      # http://localhost:3000
```

---

## Environment Variables

สร้าง `.env` ที่ root (copy จาก `.env.example`):

| Variable | Phase | คำอธิบาย | หาได้จาก |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 1 | Frontend Clerk key (baked ตอน build) | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | 1 | Backend Clerk key (runtime) | Clerk Dashboard → API Keys |
| `NEXT_PUBLIC_API_URL` | 3 | URL ของ FastAPI backend | `https://agents.korvuz.site/api` |
| `POSTGRES_PASSWORD` | 3 | PostgreSQL password | ตั้งเองได้ |
| `MINIO_USER` / `MINIO_PASSWORD` | 3 | MinIO credentials | ตั้งเองได้ |

> **หมายเหตุ:** `NEXT_PUBLIC_*` vars ถูก bake เข้า JavaScript bundle ตอน `docker compose build` → ต้อง rebuild ทุกครั้งที่เปลี่ยน key

### Clerk Setup (Phase 1)
1. ไปที่ https://dashboard.clerk.com → สร้าง Application ใหม่
2. Settings → **Organizations** → Enable
3. API Keys → copy `Publishable key` และ `Secret key`
4. ใส่ใน `.env` แล้วรัน `docker compose build && docker compose up -d`

---

## Debugging Guide

> **หลักการ:** ดู STRUCTURE.md ก่อนเสมอ เพื่อรู้ว่าควรแก้ไฟล์ไหน ไม่ต้องอ่านทั้งโปรเจกต์

### วิธี Debug แต่ละ Layer

#### Frontend — Client-side error
```
1. เปิด Browser DevTools → Console → อ่าน stack trace
2. ดูชื่อ component ใน stack → ตรงกับไฟล์ไหนใน STRUCTURE.md
3. ถ้า error = "Hook called outside ClerkProvider" → ClerkErrorBoundary หลุด
4. ถ้า error = "Cannot read properties of undefined" → check ว่า API response ถูก type ไหม
```

#### Frontend — Build error
```
npm run build   # ดู error message จะบอก file:line ตรงๆ
```

#### Container — Runtime error
```bash
docker logs agent-company-frontend --tail 50
docker logs agent-company-frontend -f          # follow live
```

#### Container — Restart loop
```bash
docker inspect agent-company-frontend | grep -A5 '"RestartCount"'
docker logs agent-company-frontend --tail 100 2>&1 | grep -i error
```

### Component Map (debug by symptom)

| อาการ | ดูที่ไหน |
|---|---|
| หน้า onboarding แสดงผิด | `app/onboarding/page.tsx` |
| Sidebar ไม่แสดง / crash | `components/shared/Sidebar.tsx`, `ClerkErrorBoundary.tsx` |
| Company switcher ไม่ทำงาน | `components/shared/CompanySwitcher.tsx` |
| Route redirect ผิด | `middleware.ts` |
| Sign-in/up page ผิด | `app/(auth)/sign-in/...` หรือ `app/(auth)/sign-up/...` |
| Earth tone ผิด | `app/globals.css` (CSS vars) + `tailwind.config.ts` |
| Docker build fail | `frontend/Dockerfile` (ดู ARG ชื่อ NEXT_PUBLIC_*) |

### Key Design Decisions (อ่านก่อนแก้)

| Decision | เหตุผล | ไฟล์ที่เกี่ยวข้อง |
|---|---|---|
| ClerkProvider conditional | Build ไม่ crash ถ้าไม่มี Clerk keys | `app/layout.tsx` |
| ClerkErrorBoundary | Sidebar ไม่ crash ถ้า Clerk hooks throw | `components/shared/ClerkErrorBoundary.tsx` |
| Sidebar ใช้ `dynamic({ ssr: false })` | Clerk hooks ไม่ทำงาน server-side | `app/dashboard/layout.tsx` |
| `NEXT_PUBLIC_` baked at build | ต้อง rebuild ทุกครั้งที่เปลี่ยน Clerk key | `frontend/Dockerfile` (ARG) |
| Clerk v5 (ไม่ใช่ v7) | v7 ต้องการ Next.js 15+ | `frontend/package.json` |
| `output: "standalone"` ใน next.config | Docker image เล็กลง (ไม่ต้อง node_modules ตอน run) | `frontend/next.config.mjs` |

---

## Git Workflow

### Branches
| Branch | ใช้สำหรับ |
|---|---|
| `main` | Production — deploy ตรงที่ agents.korvuz.site |
| `dev` | Development — merge feature branches มาที่นี่ก่อน |
| `phase/N-name` | งานต่อ phase เช่น `phase/2-agents` |
| `fix/description` | Bug fix เล็กๆ |

### Flow
```
fix/sidebar-clerk  →  dev  →  (test)  →  main  →  docker compose build + up
```

### Deploy หลัง merge to main
```bash
cd /opt/agent-company
git pull
docker compose build
docker compose up -d
```

---

## Phase Roadmap

| Phase | เนื้อหา | สถานะ |
|---|---|---|
| 0 | Next.js scaffold + Docker + Nginx | ✅ Done |
| 1 | Clerk auth + Onboarding + Sidebar + Company switcher | ✅ Done (pending Clerk keys) |
| 2 | CRUD Agent card + Skill library + Org chart | 🔜 Next |
| 3 | CrewAI pipeline runner + FastAPI backend | ⏳ Planned |
| 4 | WebSocket chat (LINE-style) + Usage tracking | ⏳ Planned |
| 5 | History + Settings (API key vault) | ⏳ Planned |
| 6 | Office visual mode (optional) | ⏳ Optional |

---

## File Header Convention

ทุกไฟล์ใหม่ต้องมี header (ตาม CONVENTIONS.md):

```ts
// Purpose: <สรุป 1 บรรทัด>
// Used by: <ไฟล์/component ที่ใช้>
```

```python
"""
Purpose: <สรุป 1 บรรทัด>
Used by: <module ที่ import>
"""
```

หลังเพิ่ม/ลบไฟล์ ให้รัน:
```bash
bash scripts/gen-structure-map.sh   # อัปเดต STRUCTURE.md อัตโนมัติ
```

---

## Data Model (Phase 3+)

```
Company (Clerk Organization)
 └─ Agent        (name, level 1-3, skills[], allowed_providers[], system_prompt)
 └─ Skill        (markdown instruction, reusable ข้าม agents)
 └─ Pipeline     (graph: nodes=agent_id, type=orchestrator|sequential)
 └─ Session      (chat thread)
     └─ Message  (user + inter-agent trace events)
     └─ UsageEvent (token, cost, latency per agent call)
 └─ ApiKeyVault  (Fernet-encrypted, per company)
```

### Level → Model Mapping (เก็บใน DB — ไม่ hardcode)
| Level | Claude | Gemini | GPT |
|---|---|---|---|
| 1 Junior | Haiku 4.5 | Flash-Lite | GPT-5.5 Instant |
| 2 Mid | Sonnet 4.6 | Pro | GPT-5.5 |
| 3 Senior | Opus 4.8 | Pro Deep Think | GPT-5.5 Pro |
