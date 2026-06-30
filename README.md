# AgentCrew

แพลตฟอร์มสร้างและบริหาร "บริษัท AI agent" — สร้าง agent เป็นการ์ดเกม (level 1-3 = LLM tier), ผูก skill, จัดเป็น pipeline, คุยงานผ่านแชท real-time พร้อม token/cost tracking

**Production:** `https://agents.korvuz.site`  
**Repo:** `https://github.com/korvuz-ai/agentcrew`  
**Branches:** `main` (scaffold baseline) · `dev` (active — ทุก feature อยู่ที่นี่)

> **สำหรับ debug:** อ่าน `DEBUG.md` ก่อน — มี quick commands, logs, DB queries, ports ครบ

---

## Auth ปัจจุบัน

**Frontend:** ไม่มี auth — `/` redirect ตรงไป `/dashboard` เลย (Clerk frontend ถูกเอาออกแล้ว)  
**Backend:** ทุก endpoint มี `# TODO: auth` — รับ `company_id` จาก URL path ตรงๆ ยังไม่ verify JWT  
**Clerk ที่เหลือใน backend:** `auth/clerk.py` (JWT verifier พร้อมใช้แต่ไม่ได้เรียก) + `webhooks.py` (sync Clerk org event → companies table)

---

## โครงสร้างโปรเจค

```
/opt/agent-company/
├── backend/
│   └── app/
│       ├── main.py                 FastAPI app: register routers, CORS, startup hooks
│       ├── auth/
│       │   └── clerk.py            get_current_company() — Clerk JWT verify (ยังไม่ได้ใช้)
│       ├── core/
│       │   ├── config.py           Settings (pydantic-settings): env vars → settings object
│       │   ├── budget.py           get_monthly_spend(), check_budget(), maybe_emit_budget_alert()
│       │   └── encryption.py       encrypt(str), decrypt(str) — Fernet ใช้ FERNET_MASTER_KEY
│       ├── crews/
│       │   ├── agent_factory.py    pick_provider(), build_crew_agent()
│       │   ├── agent_chat.py       execute_agent_chat() — background task: single-agent LLM
│       │   ├── pipeline_runner.py  execute_pipeline_run() — background task: CrewAI run
│       │   ├── fallback.py         is_rate_limit_error(), mark_rate_limited(), is_rate_limited()
│       │   └── tools.py            make_cwd_tools() + 4 filesystem tools (BaseTool)
│       ├── db/
│       │   ├── base.py             engine, AsyncSessionLocal, get_db(), Base
│       │   └── models.py           9 ORM models
│       ├── routers/
│       │   ├── agents.py           CRUD agents
│       │   ├── skills.py           CRUD skills
│       │   ├── pipelines.py        CRUD pipelines + nodes
│       │   ├── sessions.py         CRUD sessions + messages + /chat (B3)
│       │   ├── runs.py             POST /{pipeline_id}/run → create session + background task (B4)
│       │   ├── api_keys.py         GET/PUT/DELETE/test API keys (Fernet encrypted)
│       │   ├── files.py            upload/download/delete files via MinIO
│       │   ├── companies.py        GET + PATCH company (budget_cap, alert_threshold)
│       │   └── webhooks.py         POST /webhooks/clerk → upsert/delete Company row
│       ├── storage/
│       │   └── minio_client.py     ensure_bucket(), upload_bytes(), get_object(), delete_object()
│       └── ws/
│           ├── manager.py          ConnectionManager: connect/disconnect/broadcast/broadcast_from_thread
│           └── router.py           WS /ws/sessions/{session_id}
├── frontend/
│   ├── app/
│   │   ├── layout.tsx              Root layout: fonts (ไม่มี auth wrapper)
│   │   ├── page.tsx                redirect("/dashboard") ทันที
│   │   └── dashboard/
│   │       ├── layout.tsx          Shell: <Sidebar> + <main>
│   │       ├── agents/page.tsx     Agent cards + org chart tree (by managerId)
│   │       ├── chat/page.tsx       Sessions list + messages + WS real-time + status dots
│   │       ├── history/page.tsx    Past sessions + replay messages
│   │       ├── library/page.tsx    Skill cards
│   │       ├── office/page.tsx     Visual floor plan — desk idle/busy states
│   │       ├── org-chart/page.tsx  Hierarchy tree (managerId → parent agent)
│   │       ├── pipelines/page.tsx  Pipeline cards + node editor
│   │       └── settings/page.tsx   API keys per provider + budget cap + companyId
│   ├── components/
│   │   ├── agent-card/
│   │   │   ├── AgentCard.tsx       Card: avatar, level badge, providers, skills count
│   │   │   └── AgentDialog.tsx     Create/edit/delete: name, role, level, providers, skills, avatar, managerId, cwd
│   │   ├── chat/
│   │   │   ├── ChatBubble.tsx      Message bubble: user(right) / agent(left+icon)
│   │   │   └── NewSessionDialog.tsx Pipeline mode + Single Agent mode; Provider dropdown ทั้งคู่
│   │   ├── office/
│   │   │   └── AgentDesk.tsx       Desk tile: avatar + name + status
│   │   ├── pipeline/
│   │   │   ├── PipelineCard.tsx    Card: name, type badge, node count
│   │   │   └── PipelineDialog.tsx  Create/edit: name, type, nodes list, cwd field
│   │   ├── skill-card/
│   │   │   ├── SkillCard.tsx       Card: name, category, instructions preview
│   │   │   └── SkillDialog.tsx     Create/edit/delete
│   │   ├── shared/
│   │   │   └── Sidebar.tsx         Nav links + company ID display
│   │   └── ui/                     shadcn/ui components
│   └── lib/
│       ├── store.ts                Data hooks (useSessions, useAgents, useSkills, usePipelines, useSettings)
│       ├── types.ts                TypeScript types ทั้งหมด
│       ├── seeds.ts                buildDemoTeam() — demo data SEED_VERSION v5
│       ├── api.ts                  apiFetch<T>(), uploadFile()
│       ├── useSessionWS.ts         useSessionWS(sessionId, isActive, onEvent) — auto-reconnect
│       └── utils.ts                cn() classname helper
├── nginx/agent-company.conf        Nginx config (production)
├── docker-compose.yml              5 containers
├── .env.example                    Required env vars
├── DEBUG.md                        ← อ่านก่อน debug ทุกครั้ง
├── TEST_CASES.md                   Test scenarios B3-B5 + DB queries
└── FIXES.md                        Bug fix log (user updates)
```

---

## Data Model (db/models.py)

```
companies
  id, clerk_org_id, name, owner_clerk_id,
  budget_cap_usd(Decimal, default=0=unlimited), alert_threshold_pct(int, default=80)

agents
  id, company_id, name, role, backstory, avatar, level(1-3, SmallInt),
  providers(JSONB=[]), skill_ids(JSONB=[]), system_prompt, cwd(str|null), manager_id(FK agents.id)

skills
  id, company_id, name, description, category, content(Text)

pipelines
  id, company_id, name, description, process_type("sequential"|"hierarchical"), orchestrator_id, cwd

pipeline_nodes
  id, pipeline_id, agent_id, order_index(SmallInt), condition(Text|null)

sessions
  id, company_id, name, pipeline_id(null=single-agent), agent_id(null=pipeline),
  status("running"|"completed"|"failed"), total_cost_usd(Decimal)

messages
  id, session_id, role("user"|"agent"), content, agent_id(null=user msg),
  thinking, tokens_in, cost_usd, latency_ms

usage_events
  id, session_id, agent_id, tokens_in, tokens_out, cost_usd, latency_ms, provider, model

api_key_vault
  id, company_id, provider, encrypted_key  [UNIQUE: company_id+provider]

level_model_map
  id, level, provider, model_id  [UNIQUE: level+provider]
```

**Level → Model (เปลี่ยนได้ใน DB ไม่ต้อง deploy):**
| level | claude | gemini | gpt |
|-------|--------|--------|-----|
| 1 Junior | claude-haiku-4-5-20251001 | gemini/gemini-2.5-flash-lite | openai/gpt-5.5-instant |
| 2 Mid | claude-sonnet-4-6 | gemini/gemini-2.5-flash | openai/gpt-5.5 |
| 3 Senior | claude-opus-4-8 | gemini/gemini-2.5-pro | openai/gpt-5.5-pro |

---

## API Endpoints

Next.js rewrites `/api/*` → `BACKEND_URL/api/*` (Docker default: `http://backend:8000`)

### Health
```
GET /api/health   → {status, version, env, db}
GET /api/docs     → Swagger UI
```

### Companies
```
GET   /api/companies/{cid}       → {id, name, budget_cap_usd, alert_threshold_pct}
PATCH /api/companies/{cid}       {budget_cap_usd?, alert_threshold_pct?}
```

### Agents  `/api/companies/{cid}/agents`
```
GET    /          → AgentOut[]
POST   /          AgentIn {name, role, backstory, avatar, manager_id?, level, providers[], skill_ids[], system_prompt, cwd?}  → 201
GET    /{id}      → AgentOut
PATCH  /{id}      AgentPatch (all fields optional)  → AgentOut
DELETE /{id}      → 204
```

### Skills  `/api/companies/{cid}/skills`
```
GET    /          → SkillOut[]
POST   /          SkillIn {name, description, category, content}  → 201
GET    /{id}      → SkillOut
PATCH  /{id}      SkillPatch  → SkillOut
DELETE /{id}      → 204

note: frontend field "instructions" maps to backend "content"
```

### Pipelines  `/api/companies/{cid}/pipelines`
```
GET    /          → PipelineOut[] (includes nodes)
POST   /          PipelineIn {name, description, process_type, orchestrator_id?, cwd?, nodes:[{agent_id, condition?}]}  → 201
GET    /{id}      → PipelineOut
PATCH  /{id}      PipelinePatch (nodes replaces all if provided)  → PipelineOut
DELETE /{id}      → 204
POST   /{id}/run  RunIn {task: str, provider?: str}  → RunOut {session_id, status:"started"} 202  ← B4
```

### Sessions  `/api/companies/{cid}/sessions`
```
GET    /                 → SessionOut[] (with messages, ordered desc by created_at)
POST   /                 SessionIn {name, pipeline_id?, agent_id?, status}  → 201
GET    /{id}             → SessionOut
PATCH  /{id}             SessionPatch {name?, status?, total_cost_usd?}
DELETE /{id}             → 204
POST   /{id}/chat        ChatIn {content: str, preferred_provider?: str}  → 202  ← B3
GET    /{id}/messages    → MessageOut[]
POST   /{id}/messages    MessageIn {role, content, agent_id?, thinking?, tokens_in, cost_usd, latency_ms}  → 201
```

### API Keys  `/api/companies/{cid}/api-keys`
```
GET    /{provider}       → {provider, has_key, updated_at}
PUT    /{provider}       {key: str}  → {provider, has_key, updated_at}
DELETE /{provider}       → 204
GET    /{provider}/test  → {ok, latency_ms?, error?}

provider values: "claude" | "gemini" | "gpt"
```

### Files
```
POST   /api/companies/{cid}/sessions/{sid}/files   multipart field="file"  → FileOut 201
       FileOut: {filename, object_path, download_url("/api/files/..."), size_bytes, content_type}
GET    /api/files/{object_path:path}               → stream bytes
DELETE /api/companies/{cid}/sessions/{sid}/files/{object_path:path}  → 204
MinIO key: {company_id}/{session_id}/{safe_filename}   max 50 MB
```

### WebSocket
```
WS /ws/sessions/{session_id}
   client → server: any text (discarded, keeps connection alive)
   server → client: JSON events (ดู WS Events)
   nginx: location /ws/ → 127.0.0.1:8791 (WebSocket upgrade headers)
```

### Webhooks
```
POST /api/webhooks/clerk   Clerk event (svix signature required)
  organization.created / .updated → upsert Company row
  organization.deleted            → delete Company row
```

---

## WebSocket Events

```jsonc
{"type": "agent_start",   "session_id": "...", "agent_id": "..."}
{"type": "agent_thought", "session_id": "...", "content": "...", "agent_id": "..."}
// content truncated 400 chars; ส่งหลายครั้งต่อ task

{"type": "agent_done",    "session_id": "...", "agent_id": "...", "output": "..."}
// output truncated 3000 chars; emit ต่อ task (1 ครั้งต่อ 1 agent ใน sequential)

{"type": "pipeline_done", "session_id": "...", "status": "completed|failed",
  "total_cost_usd": 0.005}

{"type": "budget_alert",  "session_id": "...", "spend_usd": 8.0, "cap_usd": 10.0,
  "pct_used": 80, "threshold_pct": 80}
```

---

## Backend Functions (debug reference)

### agent_factory.py

```python
pick_provider(providers, vault_keys, company_id, skip_providers={}, preferred=None) → str
  # Priority: preferred → vault_key → env_var → providers[0]
  # Skip: Redis rate-limited providers + skip_providers set
  # 2nd pass (ignore rate-limit): ถ้าทุก provider ถูก mark ให้ยังเลือกตาม vault_key/env

build_crew_agent(db_agent, model_id, skills_content, allow_delegation, api_key, cwd_tools=None) → CrewAgent
  # backstory = agent.backstory + "\n\nCapabilities & Skills:\n" + skills_content
  # LLM = crewai.LLM(model=model_id, api_key=api_key)
  # tools=cwd_tools ถ้าไม่ว่าง
```

### agent_chat.py

```python
execute_agent_chat(company_id, session_id, agent_id, preferred_provider) [background task]
  └── _chat(db, ...)
        1. load agent + level_model_map + vault_keys + skills
        2. pick_provider() → model_id + api_key
        3. system_prompt = "You are {name}, {role}.\n{backstory+skills}"
        4. load history: SELECT messages WHERE session_id ORDER BY created_at
        5. emit agent_start WS
        6. litellm.acompletion(model, messages=[system]+history, api_key?)
        7. save Message(role="agent", agent_id, tokens_in, cost_usd, latency_ms)
        8. session.total_cost_usd += cost_usd
        9. emit agent_done WS {output, cost_usd, latency_ms, tokens}
```

### pipeline_runner.py

```python
execute_pipeline_run(company_id, pipeline_id, session_id, task_description, preferred_provider) [background task]
  └── _run(db, ...)
        1. load pipeline(+nodes) + level_map + agents + skills + vault_keys
        2. check_budget() → fail fast ถ้าเกิน cap
        3. make_cwd_tools(pipeline.cwd) → 0-4 tools
        4. build_crew_agent() per agent (workers + orchestrator)
           store raw DB agents in RunSpec for fallback rebuild
        5. RunSpec → loop.run_in_executor(_run_crew_sync)
        6. save per-agent Messages (from agent_outputs collector)
           fallback: save 1 message ถ้า agent_outputs ว่าง
        7. save UsageEvents
        8. session.status = "completed"|"failed"
        9. emit pipeline_done WS
        10. maybe_emit_budget_alert()

_run_crew_sync(spec) → (success, output, usage_events, agent_outputs)  [sync, in thread pool]
  emit agent_start per worker
  crew.kickoff()
    step_callback → emit agent_thought (truncated 400)
    task_callback → append to agent_outputs + emit agent_done
  on exception:
    is_rate_limit_error? → mark_rate_limited (Redis TTL 60s)
                         → _rebuild_workers(spec, tried)
                         → retry (max 3 attempts)
    else → _friendly_error(exc) → fail

_rebuild_workers(spec, skip) → (new_workers, new_meta)
  # ใช้ spec.raw_worker_agents (DB rows) + spec.vault_keys
  # pick_provider ใหม่โดยข้าม skip set

_friendly_error(exc) → str (Thai error message)
  # 503/ServiceUnavailable → "Provider ไม่พร้อมใช้งาน..."
  # 429/quota/rate_limit   → "Rate limit เกิน..."
  # 401/invalid key        → "API key ไม่ถูกต้อง..."
```

### fallback.py

```python
_RATE_LIMIT_SIGNALS = ["429","rate_limit","quota","RESOURCE_EXHAUSTED",
                        "503","ServiceUnavailableError","high demand","overloaded","529",...]
is_rate_limit_error(exc) → bool  # ตรวจ signal ใน str(exc).lower()
mark_rate_limited(company_id, provider)  # Redis SETEX key TTL=60s
is_rate_limited(company_id, provider)    # Redis EXISTS
clear_rate_limit(company_id, provider)   # Redis DELETE
```

### tools.py

```python
make_cwd_tools(cwd) → list  # [] ถ้า cwd ว่างหรือไม่มีจริง
_safe_path(root, rel) → Path  # resolve + check prefix (prevent ../ escape)

DirectoryListTool.list_directory(path=".")  → "FILE/DIR entries"
FileReadTool.read_file(path)                → str (max 8000 chars)
FileWriteTool.write_file(path, content)     → "Written N chars"
RunCommandTool.run_command(command)         → stdout\nstderr\nexit code (timeout 30s)
```

### core/budget.py

```python
get_monthly_spend(db, company_id) → Decimal
  # SUM(usage_events.cost_usd) JOIN sessions WHERE this calendar month

check_budget(db, company_id) → (allowed, spend, cap)
  # cap=0 → unlimited, always allowed
  # cap>0 → allowed = spend < cap

maybe_emit_budget_alert(db, company_id, session_id, new_cost)
  # เมื่อ monthly spend >= alert_threshold_pct% of cap → emit budget_alert WS
```

### ws/manager.py

```python
manager = ConnectionManager()  # singleton, imported everywhere

set_loop(loop)                         # ต้องเรียกตอน startup
connect(session_id, ws)                # accept WS + register
disconnect(session_id, ws)             # unregister + ลบ empty set
broadcast(session_id, event)           # async — ส่งทุก WS, cleanup dead connections
broadcast_from_thread(session_id, event)  # thread-safe via run_coroutine_threadsafe
```

---

## Frontend Hooks (lib/store.ts)

### `useSessions()`
```typescript
sessions: Session[]
createSession({name, pipelineId?, agentId?}) → Session         // POST + add to state
deleteSession(id)                                               // DELETE + remove from state
appendMessage(sessionId, msg)                                   // POST /messages (fire-and-forget)
appendMessageLocal(sessionId, msg)                              // local only (ใช้หลัง WS agent_done)
runPipeline(pipelineId, task, provider?) → Session             // POST /run → add session to state
agentChat(sessionId, content, provider?)                        // POST /chat (202, returns void)
refreshSession(id)                                              // GET session → replace in state
patchSessionLocal(id, {status?, totalCostUsd?})                 // WS-driven: no API call
```

### `useSettings()`
```typescript
settings: AppSettings
updateKey(provider, key)        // save providerKeys to localStorage
updateBudget({budgetCapUsd?, alertThresholdPct?})
updateCompanyId(id)             // set companyId → เปิด API mode
```

---

## Frontend Types (lib/types.ts — important field notes)

```typescript
Agent.cwd?: string              // ถ้า set → tools ทำงานได้ (agent-level cwd)
Skill.instructions: string      // frontend ชื่อ "instructions" แต่ backend รับเป็น "content"
Pipeline.type: "sequential" | "orchestrator-worker"
                                // backend process_type = "sequential" | "hierarchical"
Pipeline.cwd?: string           // pipeline-level cwd → ทุก agent ใน crew ได้ tools
ChatMessage.role: "user" | "agent"  // backend save role="agent" (ไม่ใช่ "assistant")
Session.status: "active" | "running" | "completed" | "failed"
  // "active" = มี agentId (single-agent session, idle)
  // "running" = pipeline กำลังรัน
```

---

## WS Hook (lib/useSessionWS.ts)

```typescript
useSessionWS(sessionId, isActive, onEvent)
// URL: wss://{host}/ws/sessions/{id}  (auto proto based on window.location)
// Override: NEXT_PUBLIC_WS_OVERRIDE env var
// Auto-reconnect every 3s on disconnect
// chat/page.tsx เรียก: useSessionWS(id, isRunning || isAgentSession, handleWsEvent)
//   isAgentSession = !!session.agentId (single-agent sessions ต้อง connect ตลอด)
```

---

## Demo Mode vs API Mode

| | Demo Mode | API Mode |
|-|-----------|----------|
| เปิดด้วย | Settings → Company ID ว่าง | ใส่ Company ID UUID ใน Settings |
| Data | localStorage (seed v5) | PostgreSQL via FastAPI |
| Seed trigger | SEED_VERSION mismatch → buildDemoTeam() auto-run | — |
| Pipeline run | ไม่มี backend call | POST /pipelines/{id}/run |
| Agent chat | ไม่มี AI reply | POST /sessions/{id}/chat |

---

## Environment Variables

```bash
# App
APP_ENV=production
CORS_ORIGINS=https://agents.korvuz.site,http://localhost:3000

# Database + Redis
DATABASE_URL=postgresql+asyncpg://postgres:pass@postgres:5432/agentcrew
REDIS_URL=redis://redis:6379/0

# Fernet (generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
FERNET_MASTER_KEY=<base64-key>

# Clerk (webhook only)
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
CLERK_JWKS_URL=https://....clerk.accounts.dev/.well-known/jwks.json

# LLM fallback (ถ้าไม่มีใน vault)
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
OPENAI_API_KEY=sk-...

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=agentcrew
MINIO_SECURE=false

# Frontend
BACKEND_URL=http://backend:8000     # Docker internal URL
NEXT_PUBLIC_WS_OVERRIDE=            # ว่าง = auto wss:// จาก window.location
```

---

## Services & Ports

| Container | Host Port | URL | หน้าที่ |
|-----------|-----------|-----|---------|
| frontend | 8790 | http://127.0.0.1:8790 | Next.js |
| backend | 8791 | http://127.0.0.1:8791 | FastAPI (Docker internal: :8000) |
| postgres | internal | postgres:5432 | DB |
| redis | internal | redis:6379 | rate-limit TTL keys |
| minio | 9010/9011 | http://127.0.0.1:9011 | file storage console |

**Production nginx:** `/` + `/api/` → 8790 (Next.js) · `/ws/` → 8791 (bypass Next.js, WebSocket upgrade)

---

## Alembic Migrations

```bash
docker compose exec backend alembic upgrade head      # run pending migrations
docker compose exec backend alembic current           # check version
docker compose exec backend alembic revision --autogenerate -m "desc"  # create new

Migrations: backend/alembic/versions/
  0001_init.py               — all tables
  0002_add_clerk_org_id.py
  0003_add_missing_columns.py — cwd, system_prompt, description, etc.
  0004_level_model_map.py    — table + seed data
  0005_budget_cap.py         — budget_cap_usd, alert_threshold_pct
```
