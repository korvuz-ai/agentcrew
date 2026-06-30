# AgentCrew — Debug Reference

> อ่านไฟล์นี้ก่อนเสมอ — ครอบคลุมทุก service, file, function, flow, และ debug scenario
> อย่า scan โปรเจคทั้งหมด — ทุกอย่างอยู่ที่นี่แล้ว

---

## 1. Services & Ports

| Container | Host Port | URL | หน้าที่ |
|---|---|---|---|
| `agent-company-frontend` | 8790 | http://127.0.0.1:8790 | Next.js UI |
| `agent-company-backend` | 8791 | http://127.0.0.1:8791 | FastAPI REST + WS |
| `agent-company-postgres` | (internal) | postgres:5432 | Database |
| `agent-company-redis` | (internal) | redis:6379 | rate-limit + session cache |
| `agent-company-minio` | 9010 (API), 9011 (console) | http://127.0.0.1:9011 | file storage |

Production: `https://crew.korvuz.sit` → Nginx → 8790 (frontend) / 8791 (backend)

---

## 2. Quick Commands

```bash
# ── Rebuild & restart ──────────────────────────────────────────
docker compose build --no-cache frontend && docker compose up -d --force-recreate frontend
docker compose build --no-cache backend  && docker compose up -d --force-recreate backend

# ── Logs ───────────────────────────────────────────────────────
docker compose logs -f backend                          # follow backend
docker compose logs backend 2>&1 | grep -v "GET\|POST"  # ดู error เท่านั้น
docker compose logs -f frontend

# ── DB access ──────────────────────────────────────────────────
docker compose exec postgres psql -U postgres -d agentcrew

# ── Migrations ─────────────────────────────────────────────────
docker compose exec backend alembic current       # version ปัจจุบัน
docker compose exec backend alembic upgrade head  # apply migration ใหม่
docker compose exec backend alembic check         # ตรวจว่า model ตรงกับ schema

# ── Health ─────────────────────────────────────────────────────
curl -s http://127.0.0.1:8791/api/health | python3 -m json.tool
# → {"status":"ok","version":"0.1.0","env":"production","db":"ok"}

# ── Test pipeline run ──────────────────────────────────────────
CID=5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291
PID=$(docker compose exec postgres psql -U postgres -d agentcrew -t -c \
  "SELECT id FROM pipelines WHERE company_id='$CID' LIMIT 1;" | tr -d ' \n')
curl -s -X POST "http://127.0.0.1:8791/api/companies/$CID/pipelines/$PID/run" \
  -H "Content-Type: application/json" \
  -d '{"task":"Write a 2-sentence intro about AI agents"}' | python3 -m json.tool

# ── ตรวจ sessions ใน DB ────────────────────────────────────────
docker compose exec postgres psql -U postgres -d agentcrew -c \
  "SELECT name, status, (SELECT COUNT(*) FROM messages WHERE session_id=s.id) msgs
   FROM sessions s WHERE company_id='5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291'
   ORDER BY created_at DESC;"
```

---

## 3. Backend — ทุก file และ function

### 3.1 Startup Flow

```
entrypoint.sh
  → alembic upgrade head        # apply migrations
  → uvicorn app.main:app        # port 8000
```

### 3.2 `app/main.py` — FastAPI App

```python
app = FastAPI(...)
# Routers registered:
app.include_router(agents.router)      # /api/companies/{id}/agents
app.include_router(skills.router)      # /api/companies/{id}/skills
app.include_router(pipelines.router)   # /api/companies/{id}/pipelines
app.include_router(sessions.router)    # /api/companies/{id}/sessions
app.include_router(runs.router)        # /api/companies/{id}/pipelines/{pid}/run
app.include_router(files.router)       # /api/companies/{id}/sessions/{sid}/files
app.include_router(companies.router)   # /api/companies/{id}
app.include_router(api_keys.router)    # /api/companies/{id}/api-keys/{provider}
app.include_router(webhooks.router)    # /api/webhooks/clerk
app.include_router(ws_router)          # /ws/sessions/{sid}

@app.get("/api/health")                # health check + DB ping
setup_litellm_callbacks()              # เรียกตอน startup — register LiteLLM usage callback
```

### 3.3 `app/core/config.py` — Settings

Pydantic Settings โหลดจาก `.env`:

| Variable | หน้าที่ | Required |
|---|---|---|
| `DATABASE_URL` | asyncpg connection string | ✅ |
| `REDIS_URL` | Redis connection | ✅ |
| `REDIS_PASSWORD` | Redis password | ✅ |
| `MINIO_ENDPOINT` | MinIO URL | ✅ |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | MinIO creds | ✅ |
| `CORS_ORIGINS` | comma-separated allowed origins | ✅ |
| `FERNET_MASTER_KEY` | encrypt/decrypt API keys (B7) | ✅ |
| `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `CLERK_JWKS_URL` | Clerk auth | optional |

### 3.4 `app/db/base.py` — Database

```python
engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine)

async def get_db() -> AsyncSession:  # FastAPI Depends() → yields session → commit/rollback/close
```

### 3.5 `app/db/models.py` — SQLAlchemy Models

| Class | Table | FK | สำคัญ |
|---|---|---|---|
| `Company` | `companies` | — | `clerk_org_id` UNIQUE, `budget_cap_usd`, `alert_threshold_pct` |
| `Agent` | `agents` | company_id, manager_id→self | `level` 1-3, `providers` JSONB, `skill_ids` JSONB |
| `Skill` | `skills` | company_id | `category`, `instructions` (markdown) |
| `LevelModelMap` | `level_model_map` | — | `provider`, `level`, `model_id` (LiteLLM format) |
| `Pipeline` | `pipelines` | company_id | `process_type`, `orchestrator_id`, `cwd` |
| `PipelineNode` | `pipeline_nodes` | pipeline_id, agent_id | `order_index`, `condition` |
| `Session` | `sessions` | company_id, pipeline_id?, agent_id? | `status`, `total_cost_usd` |
| `Message` | `messages` | session_id, agent_id? | `role` ("user"/"agent"), `thinking`, `tokens_in`, `cost_usd`, `latency_ms` |
| `UsageEvent` | `usage_events` | session_id, agent_id | `cost_usd`, `tokens_in`, `tokens_out`, `latency_ms` |
| `ApiKeyVault` | `api_key_vault` | company_id | `provider`, `encrypted_key` (Fernet) |

### 3.6 Routers — ทุก endpoint

#### `routers/agents.py`
```
GET    /api/companies/{id}/agents          list_agents()    → list[AgentOut]
POST   /api/companies/{id}/agents          create_agent()   → AgentOut (201)
GET    /api/companies/{id}/agents/{aid}    get_agent()      → AgentOut
PATCH  /api/companies/{id}/agents/{aid}    update_agent()   → AgentOut
DELETE /api/companies/{id}/agents/{aid}    delete_agent()   → 204
```

#### `routers/skills.py`
```
GET    /api/companies/{id}/skills          list_skills()
POST   /api/companies/{id}/skills          create_skill()
GET    /api/companies/{id}/skills/{sid}    get_skill()
PATCH  /api/companies/{id}/skills/{sid}    update_skill()
DELETE /api/companies/{id}/skills/{sid}    delete_skill()
```

#### `routers/pipelines.py`
```
GET    /api/companies/{id}/pipelines       list_pipelines() → nodes loaded via selectinload
POST   /api/companies/{id}/pipelines       create_pipeline() → creates pipeline + nodes in tx
GET    /api/companies/{id}/pipelines/{pid} get_pipeline()
PATCH  /api/companies/{id}/pipelines/{pid} update_pipeline() → deletes old nodes, inserts new
DELETE /api/companies/{id}/pipelines/{pid} delete_pipeline()
```

#### `routers/sessions.py`
```
GET    /api/companies/{id}/sessions              list_sessions()  → includes messages (selectinload)
POST   /api/companies/{id}/sessions              create_session() → AgentOut (201)
GET    /api/companies/{id}/sessions/{sid}        get_session()    → includes messages
PATCH  /api/companies/{id}/sessions/{sid}        patch_session()  → status/total_cost_usd
DELETE /api/companies/{id}/sessions/{sid}        delete_session()
GET    /api/companies/{id}/sessions/{sid}/messages    list_messages()
POST   /api/companies/{id}/sessions/{sid}/messages    append_message() → MessageOut (201)
```

#### `routers/runs.py`
```
POST /api/companies/{id}/pipelines/{pid}/run
  body: { task: str }
  → สร้าง Session (status=running)
  → เรียก execute_pipeline_run() ใน background (asyncio.create_task)
  → return { session_id, status: "started" }
```

#### `routers/files.py`
```
POST /api/companies/{id}/sessions/{sid}/files   upload_file() → multipart → MinIO
GET  /api/files/{object_path:path}              stream_file() → proxy MinIO → response
```

#### `routers/companies.py`
```
GET   /api/companies/{id}   get_company()    → { id, name, budget_cap_usd, alert_threshold_pct }
PATCH /api/companies/{id}   patch_company()  body: { budget_cap_usd?, alert_threshold_pct? }
```

#### `routers/api_keys.py`
```
GET    /api/companies/{id}/api-keys/{provider}        get_api_key()    → { has_key, updated_at }
PUT    /api/companies/{id}/api-keys/{provider}        put_api_key()    → encrypt → upsert
DELETE /api/companies/{id}/api-keys/{provider}        delete_api_key() → 204
GET    /api/companies/{id}/api-keys/{provider}/test   test_api_key()   → { ok, latency_ms, error }
  # provider ∈ {"claude","gemini","gpt"}
  # TEST MODELS: claude=claude-haiku-4-5-20251001 | gemini=gemini/gemini-3.1-flash-lite | gpt=openai/gpt-5.5-instant
```

#### `routers/webhooks.py`
```
POST /api/webhooks/clerk   → Svix verify → org.created/_updated → upsert company | org.deleted → delete company
```

### 3.7 `app/crews/pipeline_runner.py` — Core Execution

```python
class RunSpec:
    company_id: str
    pipeline_id: str
    session_id: str
    task: str

# ── Helper functions ──────────────────────────────────────────────────────────

_litellm_usage_handler(kwargs, response, start_time, end_time)
  # LiteLLM success callback — บันทึก tokens/cost/latency ใน usage_events
  # ดึง agent_id จาก metadata ที่ส่งใน extra_body

setup_litellm_callbacks()
  # ลงทะเบียน success_callback + failure_callback กับ litellm.callbacks

_emit(session_id, event)
  # Broadcast WS event ไปทุก client ที่ subscribe session นั้น
  # ใช้ asyncio.run_coroutine_threadsafe() เพราะ CrewAI รันใน sync thread

_make_step_cb(session_id) → Callable
  # CrewAI step_callback — emit "thought" event ตอน agent กำลังคิด

_make_task_cb(session_id, agent_id) → Callable
  # CrewAI task_callback — emit "agent_done" event ตอน task เสร็จ + บันทึก message ใน DB

_build_crew(spec: RunSpec) → Crew
  # อ่าน pipeline + nodes + agents จาก DB
  # สร้าง CrewAI Agent objects ด้วย build_crew_agent()
  # สร้าง Task objects
  # return Crew(agents, tasks, process=sequential|hierarchical)

_run_crew_sync(spec: RunSpec) → tuple[bool, str, list[dict]]
  # เรียก crew.kickoff() ใน sync thread (ถูกเรียกจาก loop.run_in_executor)
  # จัดการ rate-limit retry: ถ้า is_rate_limit_error(exc) → mark_rate_limited() → retry ครั้งเดียว
  # return (success, final_output, usage_events)

async execute_pipeline_run(company_id, pipeline_id, session_id, task, db)
  # Entry point จาก runs.py
  # เรียก _run() ผ่าน asyncio.create_task()

async _run(company_id, pipeline_id, session_id, task)
  # 1. เปิด DB session ใหม่ (ไม่แชร์ session กับ request)
  # 2. Budget check: check_budget() → ถ้า cap เกิน → mark_failed + return
  # 3. โหลด vault keys: GET api_key_vault WHERE company_id
  # 4. เรียก _run_crew_sync() ผ่าน run_in_executor
  # 5. บันทึก pipeline_done message + update session status
  # 6. maybe_emit_budget_alert() — emit WS ถ้า spend ถึง threshold

async _mark_failed(db, session_id, reason)
  # UPDATE sessions SET status='failed'
  # INSERT messages (role='agent', content=reason)
  # emit pipeline_done WS event (status='failed')
```

### 3.8 `app/crews/agent_factory.py`

```python
pick_provider(providers, vault_keys=None, company_id="", skip_providers=None) → str
  # เลือก LLM provider สำหรับ agent หนึ่งตัว
  # Pass 1: ต้องมี key (vault หรือ env) AND ไม่ rate-limited
  # Pass 2: ต้องมี key (ignore rate-limit ถ้าทุก provider ถูก block)
  # return ชื่อ provider เช่น "claude", "gemini", "gpt"

build_crew_agent(db_agent, model_id, api_key=None) → crewai.Agent
  # สร้าง CrewAI Agent จาก DB agent row
  # ใส่ skill instructions ใน backstory
  # ตั้ง LLM ด้วย litellm format: model_id + api_key
```

### 3.9 `app/crews/fallback.py` — Redis Rate Limit

```python
_client() → redis.Redis           # lazy Redis connection
_key(company_id, provider) → str  # "ratelimit:{cid}:{provider}"

is_rate_limit_error(exc) → bool
  # ตรวจ exception string สำหรับ: "rate_limit", "429", "quota", "too many requests"

mark_rate_limited(company_id, provider)
  # Redis SETEX key 60s → block provider 1 นาที

is_rate_limited(company_id, provider) → bool
  # Redis EXISTS key

clear_rate_limit(company_id, provider)
  # Redis DELETE key
```

### 3.10 `app/core/budget.py`

```python
async get_monthly_spend(db, company_id) → Decimal
  # SUM(cost_usd) FROM usage_events JOIN sessions
  # WHERE date_trunc('month', created_at) = current month

async check_budget(db, company_id) → tuple[bool, Decimal, Decimal]
  # (allowed, spend, cap)
  # allowed = True ถ้า cap=0 (unlimited) หรือ spend < cap

async maybe_emit_budget_alert(db, company_id, session_id, new_cost)
  # คำนวณ spend รวม new_cost
  # ถ้า spend >= cap * (threshold_pct/100) → emit "budget_alert" WS event
```

### 3.11 `app/core/encryption.py`

```python
_fernet() → Fernet  # lazy init จาก FERNET_MASTER_KEY env var

encrypt(plaintext: str) → str   # Fernet.encrypt → base64 token
decrypt(token: str) → str       # Fernet.decrypt → plaintext
# ถ้า FERNET_MASTER_KEY ไม่ set → RuntimeError
```

### 3.12 `app/ws/` — WebSocket

```python
# ws/manager.py
class ConnectionManager:
    active: dict[str, list[WebSocket]]  # session_id → list of WS connections
    connect(ws, session_id)             # accept + register
    disconnect(ws, session_id)          # deregister
    async broadcast(session_id, data)   # send JSON to all subscribers
    broadcast_from_thread(session_id, data, loop)  # thread-safe version

manager = ConnectionManager()  # singleton

# ws/router.py
GET /ws/sessions/{session_id}
  # WebSocket endpoint
  # connect → wait → disconnect
  # Client จะได้รับ events ตาม session ที่ subscribe
```

### 3.13 WebSocket Event Types

| Event | ส่งเมื่อ | Fields |
|---|---|---|
| `agent_start` | agent เริ่มทำงาน | `agent_id`, `agent_name`, `task` |
| `thought` | agent กำลังคิด (step_callback) | `agent_id`, `label` |
| `agent_done` | agent ทำ task เสร็จ | `agent_id`, `output`, `tokens`, `cost_usd`, `latency_ms` |
| `pipeline_done` | crew เสร็จทั้งหมด | `status` ("completed"/"failed"), `output`, `total_cost_usd` |
| `budget_alert` | spend ถึง threshold | `session_id`, `spend_usd`, `cap_usd`, `pct_used`, `threshold_pct` |

### 3.14 `app/storage/minio_client.py`

```python
get_client() → Minio          # lazy Minio client ต่อ settings.MINIO_*
ensure_bucket(bucket)         # create bucket ถ้าไม่มี
upload_bytes(bucket, object_path, data, content_type)
get_presigned_url(bucket, object_path, expires_sec) → str  # signed URL สำหรับ download
```

---

## 4. Database Schema

### Tables

```
companies
  id, name, clerk_org_id (UNIQUE), budget_cap_usd (default 0), alert_threshold_pct (default 80)

agents
  id, company_id (FK→companies), manager_id (nullable FK→agents, self-ref)
  name, role, backstory, avatar, level (1-3), cwd
  providers: JSONB []   e.g. ["claude","gemini"]
  skill_ids: JSONB []   e.g. ["uuid1","uuid2"]

skills
  id, company_id (FK), name, description, category, instructions (markdown)

level_model_map
  provider ("claude"|"gemini"|"gpt"), level (1-3), model_id (LiteLLM format)
  → ใช้เลือก model ตาม agent level — อ่านใน _build_crew()

pipelines
  id, company_id (FK), name, description, process_type ("sequential"|"orchestrator-worker")
  orchestrator_id (nullable FK→agents), cwd (nullable)

pipeline_nodes
  id, pipeline_id (FK), agent_id (FK→agents), order_index, condition

sessions
  id, company_id (FK), pipeline_id (nullable FK), agent_id (nullable FK)
  name, status ("active"|"running"|"completed"|"failed"), total_cost_usd

messages
  id, session_id (FK), agent_id (nullable FK)
  role ("user"|"agent"), content, thinking, tokens_in, cost_usd, latency_ms

usage_events
  id, session_id (FK), agent_id (FK)
  tokens_in, tokens_out, cost_usd, latency_ms, provider, model

api_key_vault
  id, company_id (FK), provider, encrypted_key (Fernet), updated_at
  UNIQUE(company_id, provider)
```

### Current `level_model_map` values

| Provider | Level | Model ID |
|---|---|---|
| claude | 1 | `claude-haiku-4-5-20251001` |
| claude | 2 | `claude-sonnet-4-6` |
| claude | 3 | `claude-opus-4-8` |
| gemini | 1 | `gemini/gemini-2.5-flash-lite` |
| gemini | 2 | `gemini/gemini-2.5-flash` |
| gemini | 3 | `gemini/gemini-2.5-pro` |
| gpt | 1 | `openai/gpt-5.5-instant` |
| gpt | 2 | `openai/gpt-5.5` |
| gpt | 3 | `openai/gpt-5.5-pro` |

### Migrations

| File | หน้าที่ |
|---|---|
| `0001_init.py` | สร้าง 9 tables ทั้งหมด |
| `0002_add_clerk_org_id.py` | เพิ่ม clerk_org_id ใน companies |
| `0003_add_missing_columns.py` | เพิ่ม cwd, orchestrator_id, system_prompt_override |
| `0004_level_model_map.py` | สร้าง level_model_map table + seed data |
| `0005_budget_cap.py` | เพิ่ม budget_cap_usd, alert_threshold_pct ใน companies |

---

## 5. Frontend — ทุก file และ function

### 5.1 Pages

| Route | File | หน้าที่ |
|---|---|---|
| `/` | `app/page.tsx` | redirect → /dashboard |
| `/dashboard` | `app/dashboard/page.tsx` | redirect → /dashboard/agents |
| `/dashboard/agents` | `app/dashboard/agents/page.tsx` | agent cards + create/edit/delete |
| `/dashboard/library` | `app/dashboard/library/page.tsx` | skill cards |
| `/dashboard/pipelines` | `app/dashboard/pipelines/page.tsx` | pipeline grid + builder |
| `/dashboard/chat` | `app/dashboard/chat/page.tsx` | chat sessions (pipeline / single-agent) |
| `/dashboard/history` | `app/dashboard/history/page.tsx` | session history table + replay |
| `/dashboard/office` | `app/dashboard/office/page.tsx` | visual office floor plan |
| `/dashboard/org-chart` | `app/dashboard/org-chart/page.tsx` | org tree by managerId |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | API key vault + budget cap |

### 5.2 Dashboard Layout (`app/dashboard/layout.tsx`)

```tsx
<div className="flex h-screen overflow-hidden">
  <Sidebar />                                          // left nav
  <main className="relative flex-1 overflow-y-auto p-6">  // content area
    {children}
  </main>
</div>

// หมายเหตุ: main มี position:relative เพื่อให้ chat page ใช้ absolute inset-0 ได้
// หน้าปกติใช้ overflow-y-auto ที่ main
// chat page ใช้ absolute inset-0 เพื่อ fill ทั้ง main area
```

### 5.3 `lib/types.ts` — TypeScript Types

```typescript
Provider = "claude" | "gemini" | "gpt"
Level    = 1 | 2 | 3
SessionStatus = "active" | "running" | "completed" | "failed"

Agent        { id, name, role, backstory, avatar, managerId?, level, providers[], skillIds[], systemPromptOverride, cwd? }
Skill        { id, name, description, category, instructions }
Pipeline     { id, name, description, type, orchestratorId, nodes[], cwd? }
PipelineNode { id, agentId, condition }
Session      { id, name, pipelineId?, agentId?, messages[], totalCostUsd, status }
ChatMessage  { id, role, agentId?, content, thinking?, tokens?, costUsd?, latencyMs? }
AppSettings  { companyId, providerKeys, budgetCapUsd, alertThresholdPct }

// Constants:
AGENT_IMAGES[]        // filenames ใน /public/agents/
LEVEL_LABEL           // 1→"Junior" 2→"Mid" 3→"Senior"
LEVEL_COLOR           // Tailwind classes per level
LEVEL_MODELS          // { 1: { claude: "Haiku 4.5", ... }, ... }
PROVIDER_LABEL/COLOR  // display + chip color
```

### 5.4 `lib/api.ts`

```typescript
apiFetch<T>(path, options?) → Promise<T>
  // fetch wrapper → throw Error ถ้า !res.ok
  // path ต้องขึ้นต้นด้วย /api/... (Next.js proxy → backend:8000)
  // 204 → return undefined

uploadFile(companyId, sessionId, file) → Promise<FileUploadResult>
  // multipart POST → /api/companies/{id}/sessions/{sid}/files
  // return { filename, object_path, download_url, size_bytes, content_type }
```

### 5.5 `lib/store.ts` — Data Hooks

**Mode switch**: ถ้า `localStorage.getItem("korvuz:company-id")` มีค่า → API mode ไม่งั้น localStorage mode

```typescript
// ── useAgents() ───────────────────────────────────────────────
agents[]
createAgent(data) → Agent         // POST /agents หรือ localStorage
updateAgent(id, patch) → Agent    // PATCH /agents/{id}
deleteAgent(id)                   // DELETE /agents/{id}
resetToDemo()                     // force re-seed localStorage

// ── useSkills() ───────────────────────────────────────────────
skills[]
createSkill(data) → Skill
updateSkill(id, patch) → Skill
deleteSkill(id)

// ── usePipelines() ────────────────────────────────────────────
pipelines[]
createPipeline(data) → Pipeline
updatePipeline(id, patch) → Pipeline
deletePipeline(id)

// ── useSessions() ─────────────────────────────────────────────
sessions[]                                  // โหลดจาก API (with messages) หรือ localStorage

createSession(data) → Session               // POST /sessions หรือ localStorage
deleteSession(id)                           // DELETE /sessions/{id}

appendMessage(sessionId, message)           // local state + POST /sessions/{id}/messages (API mode)

runPipeline(pipelineId, task) → Session|null
  // POST /pipelines/{pid}/run → { session_id }
  // GET /sessions/{session_id} → Session
  // prepend to sessions state

refreshSession(id)
  // GET /sessions/{id} → fresh session with latest messages
  // replace ใน sessions state (เรียกทุกครั้งที่ user คลิก session)

patchSessionLocal(sessionId, patch)         // update status/totalCostUsd จาก WS event
appendMessageLocal(sessionId, message)      // append message จาก WS event (ไม่ POST ซ้ำ)

// ── useSettings() ─────────────────────────────────────────────
companyId, providerKeys, budgetCapUsd, alertThresholdPct
getCompanyId() → string | null   // ดึงจาก localStorage "korvuz:company-id"
updateKey(provider, key)
updateBudget(capUsd, thresholdPct)
```

**localStorage keys:**
```
korvuz:company-id      → Company UUID (ถ้า set = API mode)
korvuz:agents          → Agent[]
korvuz:skills          → Skill[]
korvuz:pipelines       → Pipeline[]
korvuz:sessions        → Session[]
korvuz:settings        → AppSettings
korvuz:seed-version    → "v5" (bump เพื่อ force re-seed)
```

**Force re-seed:**
```javascript
// DevTools Console:
localStorage.removeItem('korvuz:seed-version'); location.reload()
```

### 5.6 `lib/useSessionWS.ts`

```typescript
useSessionWS(sessionId, isRunning, handleWsEvent)
  // เปิด WS connection ไป /ws/sessions/{sessionId}
  // ถ้า isRunning=false หรือ sessionId=null → ไม่ connect
  // reconnect อัตโนมัติถ้า connection ตาย
  // call handleWsEvent(event) ทุกครั้งที่ได้รับ message

// WSEvent types ที่ handleWsEvent รับ:
// { type: "agent_start", agent_id, agent_name, task }
// { type: "thought", agent_id, label }
// { type: "agent_done", agent_id, output, tokens, cost_usd, latency_ms }
// { type: "pipeline_done", status, output, total_cost_usd }
// { type: "budget_alert", session_id, spend_usd, cap_usd, pct_used, threshold_pct }
```

### 5.7 Chat Page (`app/dashboard/chat/page.tsx`)

```typescript
// State:
selectedId           // session ที่ selected
sessions, pipelines, agents   // จาก stores
thinking             // { agentId?, label } ขณะ agent คิด
budgetAlert          // { spendUsd, capUsd, pctUsed } หรือ null

// Key functions:
handleWsEvent(event)
  // "agent_start" → setThinking({ agentId, label: "Starting..." })
  // "thought"     → setThinking({ agentId, label })
  // "agent_done"  → appendMessageLocal() + patchSessionLocal()
  // "pipeline_done" → setThinking(null) + patchSessionLocal(status/cost) + refreshSession()
  // "budget_alert"  → setBudgetAlert(...) + timeout 10s clear

handleCreate(name, target)
  // Pipeline mode: runPipeline(pipelineId, name) → เรียก /pipelines/{id}/run
  // Agent mode: createSession({ status: "active" }) → ไม่ run AI

handleSend()
  // appendMessage(selectedId, userMsg)
  // ถ้า isPipelineSession → warn user (pipeline ไม่รับ message เพิ่ม)

// ── Layout structure ──────────────────────────────────────────
<div className="absolute inset-0 flex overflow-hidden">  // full-screen
  <div className="flex w-56 flex-col border-r">          // session sidebar
    "+ New session" button
    session list (คลิก → setSelectedId + refreshSession)
  </div>
  <div className="flex flex-1 flex-col overflow-hidden">  // chat area
    top bar (session name, status dot, cost)
    <div className="flex-1 overflow-y-auto py-3">         // scrollable messages
      ChatBubble per message
      thinking indicator (dot animation)
    </div>
    input bar (disabled ถ้า isRunning)
  </div>
</div>
```

### 5.8 Components

| Component | File | Props หลัก | หน้าที่ |
|---|---|---|---|
| `AgentCard` | `agent-card/AgentCard.tsx` | `agent`, `skills`, `onEdit`, `onDelete` | card แสดง agent: level badge, provider chips, skill tags |
| `AgentDialog` | `agent-card/AgentDialog.tsx` | `open`, `agent?`, `skills`, `agents`, `onSave`, `onClose` | form: name, role, backstory, level picker, provider checkboxes, skill multiselect, managerId |
| `SkillCard` | `skill-card/SkillCard.tsx` | `skill`, `usageCount`, `onEdit`, `onDelete` | card แสดง skill: category chip, description |
| `SkillDialog` | `skill-card/SkillDialog.tsx` | `open`, `skill?`, `onSave`, `onClose` | form: name, category, description, instructions (markdown textarea) |
| `PipelineCard` | `pipeline/PipelineCard.tsx` | `pipeline`, `agents`, `onEdit`, `onDelete` | card: type badge, agent sequence preview |
| `PipelineDialog` | `pipeline/PipelineDialog.tsx` | `open`, `pipeline?`, `agents`, `onSave`, `onClose` | form: name, type toggle, orchestrator picker, worker list ↕ drag |
| `ChatBubble` | `chat/ChatBubble.tsx` | `message`, `agent?` | user bubble (right, bg-primary) / agent bubble (left, border) + thinking collapsible + stats |
| `NewSessionDialog` | `chat/NewSessionDialog.tsx` | `open`, `pipelines`, `agents`, `onCreate`, `onClose` | Pipeline tab (task required) / Single Agent tab |
| `AgentDesk` | `office/AgentDesk.tsx` | `agent`, `state` | office desk card: avatar, status animation (idle/thinking/working/talking) |
| `Sidebar` | `shared/Sidebar.tsx` | — | nav links, phase gate lock icons |

---

## 6. Data Flow — Pipeline Run (B4/B5)

```
User (UI)                    Frontend                  Backend                    CrewAI / LLM
─────────────────────────────────────────────────────────────────────────────────────────────
Click "Start session"
  (Pipeline mode)
                    ──POST /pipelines/{pid}/run──→   create Session(status=running)
                                                      asyncio.create_task(_run())
                    ←── { session_id, "started" } ──
Open WS connection  ──WS /ws/sessions/{sid}──────→  accept connection

                                                      _run():
                                                        check_budget()
                                                        load vault keys
                                                        _build_crew(spec)
                                                              ↓
                                                        _run_crew_sync()
                                                              ↓
                                                         crew.kickoff()
                                                              ↓
                                                    ┌── agent.execute_task()
                                                    │     ↓
                    ←── WS: agent_start ────────────┤  _make_step_cb()
                    ←── WS: thought ─────────────────┤     ↓
                    ←── WS: agent_done ──────────────┘  litellm.completion()
                                                              ↓
                                                    _litellm_usage_handler()
                                                    INSERT usage_events
                                                    _make_task_cb()
                                                    INSERT messages (role=agent)
                                                              ↓
                                                    (next agent in pipeline...)
                                                              ↓
                                                    UPDATE sessions SET status=completed
                    ←── WS: pipeline_done ─────────────────────────────────────
handleWsEvent()
  pipeline_done
  → refreshSession()  ──GET /sessions/{sid}──────→
                    ←── { session with messages } ─
  → render messages
```

---

## 7. Settings Page — API Mode Toggle

| State | Trigger | หน้าที่ |
|---|---|---|
| **localStorage mode** | ไม่มี Company ID | ใช้ demo seed, ไม่คุย backend |
| **API mode** | มี Company ID ใน settings | ทุก hook เรียก backend แทน localStorage |

**วิธีเปิด API mode:**
1. ไป Settings → "Backend Connection" → ใส่ Company UUID: `5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291`
2. Save → page reload → โหลด agents/skills/pipelines/sessions จาก DB

**API Key Vault (B7):**
- Settings → API Keys section → ใส่ key → Save → Test
- Key ถูก Fernet-encrypt ใน DB (ดู `app/core/encryption.py`)
- Pipeline runner โหลด key ตอน run → ใช้แทน env var

---

## 8. Common Debug Scenarios

### Pipeline stuck at "running"
```bash
# ดู backend log
docker compose logs backend 2>&1 | grep -v "GET\|POST" | tail -30

# ตรวจ session status
docker compose exec postgres psql -U postgres -d agentcrew -c \
  "SELECT name, status FROM sessions ORDER BY created_at DESC LIMIT 5;"

# Reset stuck session
docker compose exec postgres psql -U postgres -d agentcrew -c \
  "UPDATE sessions SET status='failed' WHERE status='running';"
```

### Messages ไม่แสดงใน chat
- ตรวจว่า Company ID set ใน Settings (ต้องเป็น API mode)
- ลอง refresh หน้า → คลิก session ใหม่ → `refreshSession()` จะดึง messages ใหม่
- ตรวจ DB: `SELECT role, LEFT(content,60) FROM messages WHERE session_id='...' ORDER BY created_at;`

### Gemini API error
```
503 UNAVAILABLE: high demand → รอ retry, หรือ switch model
404 NOT_FOUND model → ตรวจ level_model_map ใน DB
401 API key invalid → ตรวจ vault ใน Settings → Test button
```

```bash
# ดู level_model_map
docker compose exec postgres psql -U postgres -d agentcrew -c \
  "SELECT provider, level, model_id FROM level_model_map ORDER BY provider, level;"

# แก้ model ถ้าผิด
docker compose exec postgres psql -U postgres -d agentcrew -c \
  "UPDATE level_model_map SET model_id='gemini/gemini-2.5-flash' WHERE provider='gemini' AND level=2;"
```

### Frontend ไม่ update หลังแก้ code
Docker ไม่มี hot-reload:
```bash
docker compose build --no-cache frontend && docker compose up -d --force-recreate frontend
```

### Disk full (Docker image build fail)
```bash
docker system prune -f   # ลบ unused images/containers → ~10GB free
```

### Migration drift
```bash
docker compose exec backend alembic check
# ถ้า drift → แก้ migration → rebuild backend → alembic upgrade head (auto via entrypoint.sh)
```

---

## 9. Nginx (`nginx/agent-company.conf`)

```nginx
crew.korvuz.sit → 80  → 301 HTTPS
crew.korvuz.sit → 443
  /       → proxy 127.0.0.1:8790  (Next.js frontend)
  /api/   → proxy 127.0.0.1:8791  (FastAPI REST)
  /ws/    → proxy 127.0.0.1:8791  (WebSocket, timeout 86400s, Upgrade header)
```

SSL: Let's Encrypt `/etc/letsencrypt/live/crew.korvuz.sit/`

---

## 10. Phase Roadmap

| Phase | Status | หน้าที่ |
|---|---|---|
| B0 | ✅ | FastAPI scaffold, Docker, Nginx, health endpoint |
| B1 | ✅ | SQLAlchemy models, Alembic migrations, async engine |
| B2 | ✅ | Clerk webhook sync, JWT dependency |
| B3 | ✅ | CRUD REST — agents, skills, pipelines, sessions; frontend API swap |
| B4 | ✅ | CrewAI runner, level_model_map, POST /run, UsageEvent tracking |
| B5 | ✅ | WebSocket — agent_start/thought/done/pipeline_done events; real-time chat |
| B6 | ✅ | MinIO file upload; chat Paperclip button; signed URL download |
| B7 | ✅ | Fernet API key vault; Settings dual-mode; vault keys loaded in runner |
| B8 | ✅ | Budget cap (migration 0005); check_budget(); budget_alert WS; provider fallback (Redis 60s) |
| BX | ⬜ | License key — gen from DB, encrypt, use as access gate (implement LAST) |

---

## 11. Company ID สำหรับ Test

```
Company ID: 5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291
ใส่ใน: Settings → Backend Connection → Company ID field
```
