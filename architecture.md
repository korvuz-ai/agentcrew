# Architecture — AgentCrew Platform

## High-level flow
```
[Next.js Frontend] ──REST──> [FastAPI Backend] ──> [CrewAI Agent Layer] ──> [Claude/Gemini/GPT]
        │                          │                       │
        └──────WebSocket──────────┘                       ▼
   (agent trace, token/cost/time live)              [PostgreSQL / Redis / MinIO]
```

## Project structure (monorepo)
```
agent-crew-platform/
├── backend/
│   ├── app/
│   │   ├── api/                    # REST route handlers
│   │   │   ├── companies.py        # create/select company (Clerk org sync)
│   │   │   ├── agents.py           # CRUD agent card
│   │   │   ├── skills.py           # CRUD library/skill
│   │   │   ├── pipelines.py        # CRUD pipeline definition + trigger run
│   │   │   ├── chat.py             # session/message REST (history load)
│   │   │   ├── settings.py         # API key vault CRUD
│   │   │   └── usage.py            # token/cost/time query สำหรับ dashboard
│   │   ├── core/
│   │   │   ├── config.py           # env settings (pydantic-settings)
│   │   │   ├── security.py         # verify Clerk JWT
│   │   │   ├── llm_router.py       # level+provider -> actual model id (จาก config table)
│   │   │   └── encryption.py       # Fernet encrypt/decrypt API key vault
│   │   ├── crews/
│   │   │   ├── agent_factory.py    # build CrewAI Agent จาก DB record
│   │   │   ├── pipeline_runner.py  # build Crew (Process.hierarchical / sequential)
│   │   │   └── fallback.py         # provider fallback logic เมื่อ rate-limit
│   │   ├── models/                 # SQLAlchemy ORM
│   │   ├── schemas/                # Pydantic request/response
│   │   ├── ws/
│   │   │   └── manager.py          # WebSocket connection manager + broadcast event
│   │   ├── storage/
│   │   │   └── minio_client.py     # upload/get signed URL
│   │   └── main.py                 # FastAPI app entrypoint
│   ├── alembic/                    # DB migrations
│   ├── requirements.txt
│   ├── docker-compose.override.yml
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── (auth)/                 # Clerk sign-in/sign-up pages
│   │   ├── onboarding/             # สร้าง/เลือกบริษัท
│   │   ├── dashboard/
│   │   │   ├── org-chart/page.tsx
│   │   │   ├── library/page.tsx
│   │   │   ├── agents/page.tsx
│   │   │   ├── agents/[id]/page.tsx
│   │   │   ├── pipelines/page.tsx
│   │   │   ├── pipelines/[id]/edit/page.tsx
│   │   │   ├── chat/[sessionId]/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── agent-card/
│   │   ├── org-chart/
│   │   ├── pipeline-builder/
│   │   ├── chat/
│   │   └── shared/
│   ├── lib/
│   │   ├── api.ts                  # REST client
│   │   └── ws.ts                   # WebSocket client hook
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml               # postgres, redis, minio, backend, frontend
├── .env.example
├── CLAUDE.md
├── TASKS.md
└── README.md
```

## Frontend ↔ Backend contract

**REST (CRUD ทั่วไป):**
| Endpoint | Method | หน้าที่ |
|---|---|---|
| `/companies` | GET/POST | list/create company |
| `/agents` | GET/POST/PATCH/DELETE | จัดการการ์ด agent |
| `/skills` | GET/POST/PATCH/DELETE | จัดการ library |
| `/pipelines` | GET/POST/PATCH | จัดการ pipeline definition |
| `/pipelines/{id}/run` | POST | สั่งรัน pipeline (return session_id) |
| `/sessions/{id}/messages` | GET | โหลด history เก่า |
| `/settings/api-keys` | GET/POST | จัดการ API key vault |
| `/usage/summary` | GET | token/cost รวมต่อ company/session |

**WebSocket (`/ws/sessions/{session_id}`) — event ที่ broadcast:**
```json
{ "type": "agent_start",  "agent": "researcher", "step": 1 }
{ "type": "agent_thought", "agent": "researcher", "text": "..." }
{ "type": "agent_done",   "agent": "researcher", "usage": {"tokens": 1200, "cost": 0.004, "ms": 2300} }
{ "type": "pipeline_done", "final_output": "...", "total_cost": 0.021 }
```
Frontend ใช้ event เดียวกันนี้ render ได้ทั้ง 2 view: chat bubble (LINE-style) และ
office visual (ถ้าทำ phase หลัง) — ไม่ต้องเขียน event schema 2 ชุด

## Deployment topology (VPS เดิม)
```
Nginx
 ├─ invoice.korvuz.sit   -> InvoiceAI (PM2, Node)
 ├─ crew.korvuz.sit      -> frontend container (Next.js, port 3001)
 └─ crew.korvuz.sit/api  -> backend container (FastAPI, port 8001)

docker-compose: postgres(5433) + redis(6380) + minio(9001) + backend + frontend
(เลือก port ไม่ชนกับที่ InvoiceAI ใช้อยู่)
```
