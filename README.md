# AgentCrew Platform (korvuz.exe)

แพลตฟอร์มสร้างและบริหาร "บริษัท AI agent" — สร้าง agent เป็นการ์ดเกม, ผูก skill, จัดเป็น pipeline, คุยงานผ่านแชท real-time พร้อม token/cost tracking

**Production:** `https://agents.korvuz.site`  
**Repo:** `https://github.com/korvuz-ai/korvuz-exe`  
**Branches:** `main` (stable) · `dev` (active development)

---

## โครงสร้างโปรเจค

```
/opt/agent-company/
├── backend/                    FastAPI + CrewAI (Python)
│   ├── app/
│   │   ├── main.py             Entry point — FastAPI app, CORS, startup hooks
│   │   ├── auth/               Clerk JWT dependency (get_current_company)
│   │   ├── core/
│   │   │   ├── config.py       Settings from env vars
│   │   │   ├── budget.py       Budget cap check + alert emit
│   │   │   └── encryption.py   Fernet encrypt/decrypt for API keys
│   │   ├── crews/
│   │   │   ├── agent_factory.py    DB Agent → crewai.Agent + pick_provider()
│   │   │   ├── agent_chat.py       B3: single-agent LLM chat (background task)
│   │   │   ├── pipeline_runner.py  B4: CrewAI crew execution (sequential/hierarchical)
│   │   │   ├── fallback.py         Rate-limit + 503 detection, Redis TTL tracking
│   │   │   └── tools.py            Filesystem tools: list_dir, read_file, write_file, run_cmd
│   │   ├── db/
│   │   │   ├── base.py         AsyncSessionLocal, get_db dependency
│   │   │   └── models.py       SQLAlchemy ORM: 9 tables
│   │   ├── routers/
│   │   │   ├── agents.py       CRUD /api/companies/{cid}/agents
│   │   │   ├── skills.py       CRUD /api/companies/{cid}/skills
│   │   │   ├── pipelines.py    CRUD /api/companies/{cid}/pipelines
│   │   │   ├── sessions.py     CRUD + /chat endpoint (B3)
│   │   │   ├── runs.py         POST /pipelines/{id}/run (B4)
│   │   │   ├── api_keys.py     GET/PUT /api-keys/{provider}
│   │   │   ├── files.py        POST /sessions/{id}/files (MinIO)
│   │   │   ├── companies.py    GET /api/companies/{cid}
│   │   │   └── webhooks.py     POST /api/webhooks/clerk
│   │   ├── storage/            MinIO client helpers
│   │   └── ws/
│   │       ├── manager.py      ConnectionManager: register/broadcast per session_id
│   │       └── router.py       WS /ws/sessions/{session_id}
│   ├── migrations/             Alembic migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                   Next.js 14 (App Router)
│   ├── app/dashboard/
│   │   ├── layout.tsx          Shell layout (Sidebar + main area)
│   │   ├── agents/page.tsx     Agent cards + org chart
│   │   ├── chat/page.tsx       Chat UI — sessions + WS stream
│   │   ├── history/page.tsx    Past sessions + replay
│   │   ├── library/page.tsx    Skill library
│   │   ├── office/page.tsx     Visual floor plan — desk states
│   │   ├── org-chart/page.tsx  Hierarchy tree
│   │   ├── pipelines/page.tsx  Pipeline cards + nodes editor
│   │   └── settings/page.tsx   API keys + budget cap
│   ├── components/
│   │   ├── agent-card/         AgentCard, AgentDialog
│   │   ├── chat/               ChatBubble, NewSessionDialog
│   │   ├── office/             AgentDesk, FloorPlan
│   │   ├── pipeline/           PipelineCard, PipelineDialog
│   │   ├── skill-card/         SkillCard, SkillDialog
│   │   └── shared/             Sidebar, etc.
│   ├── lib/
│   │   ├── store.ts            useSessions, useAgents, useSkills, usePipelines
│   │   ├── types.ts            TypeScript interfaces
│   │   ├── seeds.ts            Demo data (SEED_VERSION v5)
│   │   ├── api.ts              apiFetch helper
│   │   └── useSessionWS.ts     WebSocket hook
│   ├── next.config.mjs         Rewrites /api/* → backend:8000
│   └── Dockerfile
├── nginx/agent-company.conf    Nginx config template
├── docker-compose.yml          5 containers
├── DEBUG.md                    ← อ่านอันนี้ก่อน debug ทุกครั้ง
├── TASKS.md                    Backlog (B0–BX phases)
└── .env.example                Required environment variables
```

---

## Data Model

```
companies
  └── agents       (name, role, level 1-3, providers[], skill_ids[], backstory, avatar, managerId)
  └── skills       (name, content, tags[])
  └── pipelines    (name, process_type, orchestrator_id, cwd)
      └── pipeline_nodes  (agent_id, order_index)
  └── sessions     (name, pipeline_id, agent_id, status, total_cost_usd)
      └── messages (role, content, agent_id, tokens_in, cost_usd, latency_ms)
      └── usage_events (agent_id, tokens_in/out, cost_usd, latency_ms, provider, model)
  └── api_key_vault (provider, encrypted_key)
level_model_map    (level, provider, model_id)
```

### Level → Model (ไม่ hardcode — เก็บใน DB)

| Level | Claude | Gemini | GPT |
|-------|--------|--------|-----|
| 1 Junior | claude-haiku-4-5-20251001 | gemini/gemini-2.5-flash-lite | openai/gpt-5.5-instant |
| 2 Mid | claude-sonnet-4-6 | gemini/gemini-2.5-flash | openai/gpt-5.5 |
| 3 Senior | claude-opus-4-8 | gemini/gemini-2.5-pro | openai/gpt-5.5-pro |

---

## API Reference

### REST `/api/companies/{cid}/...`

| Method | Path | หน้าที่ |
|--------|------|---------|
| GET | /agents | list agents |
| POST | /agents | create agent |
| PATCH | /agents/{id} | update agent |
| DELETE | /agents/{id} | delete agent |
| GET | /skills | list skills |
| POST | /skills | create skill |
| PATCH | /skills/{id} | update |
| DELETE | /skills/{id} | delete |
| GET | /pipelines | list pipelines + nodes |
| POST | /pipelines | create pipeline |
| PATCH | /pipelines/{id} | update + replace nodes |
| DELETE | /pipelines/{id} | delete |
| GET | /sessions | list sessions + messages |
| POST | /sessions | create session |
| DELETE | /sessions/{id} | delete |
| **POST** | **/sessions/{id}/chat** | **B3: single-agent LLM reply** |
| **POST** | **/pipelines/{id}/run** | **B4: run CrewAI pipeline** |
| GET | /api-keys/{provider} | key exists? |
| PUT | /api-keys/{provider} | save encrypted key |
| GET | /api-keys/{provider}/test | test key validity |
| POST | /sessions/{id}/files | upload → MinIO |

### WebSocket `WS /ws/sessions/{session_id}`

Events emitted (backend → frontend):

```json
{"type": "agent_start",   "session_id": "...", "agent_id": "..."}
{"type": "agent_thought", "session_id": "...", "content": "...", "agent_id": "..."}
{"type": "agent_done",    "session_id": "...", "agent_id": "...", "output": "...",
                          "cost_usd": 0.001, "latency_ms": 2340, "tokens": 847}
{"type": "pipeline_done", "session_id": "...", "status": "completed", "total_cost_usd": 0.005}
{"type": "budget_alert",  "session_id": "...", "spend_usd": 8.0, "cap_usd": 10.0, "pct_used": 80}
```

---

## Frontend Store (lib/store.ts)

```typescript
// useSessions()
createSession(data)                          // POST /sessions
deleteSession(id)
appendMessage(sessionId, msg)                // POST /sessions/{id}/messages (fire-and-forget)
appendMessageLocal(sessionId, msg)           // local only — used after WS agent_done
runPipeline(pipelineId, task, provider?)     // POST /pipelines/{id}/run → returns Session
agentChat(sessionId, content, provider?)     // POST /sessions/{id}/chat (B3)
refreshSession(id)                           // GET /sessions/{id} → replace local
patchSessionLocal(id, {status, totalCostUsd}) // WS-driven status update

// useAgents() / useSkills() / usePipelines()
// Standard CRUD — each syncs with backend API when companyId is set,
// falls back to localStorage when no companyId (demo mode)
```

---

## Pipeline Execution Flow (B4+B5)

```
POST /pipelines/{id}/run {task, provider?}
  ↓ create Session (status=running) + save user Message
  ↓ BackgroundTask: execute_pipeline_run()
      _run() [async]:
        load pipeline + agents + skills + level_model_map + vault_keys
        make_cwd_tools(pipeline.cwd)          ← tools ถ้ามี Working Directory
        build_crew_agent() × N (with tools)
        _run_crew_sync() [thread pool]:
          emit agent_start WS × N
          crew.kickoff()
            task_cb per agent → emit agent_done WS + collect output
            step_cb → emit agent_thought WS
          on error → is_rate_limit_error? → skip provider → rebuild → retry (max 3×)
        save Message per agent to DB
        save UsageEvents
        emit pipeline_done WS
```

## Single-Agent Chat Flow (B3)

```
POST /sessions/{id}/chat {content, preferred_provider?}
  ↓ save user Message to DB
  ↓ BackgroundTask: execute_agent_chat()
      load agent + skills + vault_keys + level_model_map
      pick_provider() → model_id + api_key
      build system_prompt (role + backstory + skills)
      load conversation history from DB
      emit agent_start WS
      litellm.acompletion(model, messages, api_key)
      save AI Message to DB + update session.total_cost_usd
      emit agent_done WS {output, cost_usd, latency_ms, tokens}
```

---

## Agent Filesystem Tools (crews/tools.py)

Pipeline ที่มี `cwd` field จะให้ agents รัน tools เหล่านี้:

| Tool name | Input | ทำอะไร |
|-----------|-------|---------|
| `list_directory` | path (relative) | list files/dirs |
| `read_file` | path (relative) | อ่าน file content (max 8000 chars) |
| `write_file` | path, content | เขียน/สร้าง file |
| `run_command` | command | รัน shell command (timeout 30s) |

Security: path traversal ถูกป้องกัน — `pathlib.Path.resolve()` ต้องอยู่ใน cwd  
Setup: Pipelines → Edit → Working Directory = `/path/to/repo`

---

## Provider Fallback

```python
# pick_provider() priority:
# preferred > vault_key (DB encrypted) > env_var > first_in_list
# Skip: Redis-marked rate-limited providers (TTL 60s)

# Triggers retry (max 3 attempts):
is_rate_limit_error(exc) catches:
  429, rate_limit, quota, RESOURCE_EXHAUSTED  ← rate limit
  503, ServiceUnavailableError, high demand   ← server overload (Gemini)
  529, overloaded                              ← Anthropic overload
```

---

## Services & Ports

| Container | Port | URL | หน้าที่ |
|-----------|------|-----|---------|
| frontend | 8790 | http://127.0.0.1:8790 | Next.js |
| backend | 8791 | http://127.0.0.1:8791 | FastAPI |
| postgres | internal | postgres:5432 | DB |
| redis | internal | redis:6379 | cache |
| minio | 9010/9011 | http://127.0.0.1:9011 | files |

Production: `agents.korvuz.site` → nginx → 8790 (/ routes) + 8791 (/ws/ routes)

---

## Quick Debug (อ่าน DEBUG.md สำหรับรายละเอียดเต็ม)

```bash
# Rebuild
docker compose build --no-cache frontend && docker compose up -d --force-recreate frontend
docker compose build --no-cache backend  && docker compose up -d --force-recreate backend

# Logs (errors only)
docker compose logs backend 2>&1 | grep -v "GET\|POST\|WebSocket\|INFO"

# Health
curl -s http://127.0.0.1:8791/api/health

# DB
docker compose exec postgres psql -U postgres -d agentcrew
```

---

## Bug Fix Log

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Agent ไม่ตอบ (single) | ไม่มี backend endpoint | POST /sessions/{id}/chat + execute_agent_chat() |
| WS ไม่ connect agent session | `isRunning` = false เสมอ | เพิ่ม `isAgentSession` flag |
| /ws/ ล้มเหลว nginx | nginx ส่งไป Next.js (port 8790) | เพิ่ม `location /ws/` → port 8791 |
| Gemini 503 ไม่ retry | _RATE_LIMIT_SIGNALS ขาด 503 | เพิ่ม ServiceUnavailableError etc. |
| Fallback ไม่ rebuild agents | "can't access DB in sync thread" | เก็บ raw agent data ใน RunSpec |
| Pipeline save 1 msg เท่านั้น | DB persist final output only | agent_outputs collector per task_cb |
| Messages ลอยบน | flex container start-from-top | flex-col + spacer div |
| Input bar ปิดหลัง pipeline จบ | `isPipelineSession` = always hide | แก้เป็น `isPipelineSession && isRunning` |
| Provider selector ไม่มี (single agent) | เพิ่มแค่ pipeline | copy dropdown ไป single agent tab |
| Agent ไม่มี tool เข้า server | build_crew_agent ไม่รับ tools | tools.py + cwd wiring ใน pipeline_runner |
