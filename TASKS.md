# TASKS.md — AgentCrew Platform

> ใช้คู่กับ CLAUDE.md (context) และ architecture.md (รายละเอียด stack/structure)
> ทำเรียงตาม phase ห้ามข้าม phase 0-1 เพราะ phase หลังพึ่งพา auth/DB ที่ตั้งไว้

## Phase 0 — Scaffold & Infra
- [ ] init monorepo, `backend/` (FastAPI) + `frontend/` (Next.js 14)
- [ ] docker-compose: postgres, redis, minio, backend, frontend
- [ ] Alembic init + base models (Company, Agent, Skill, Pipeline, Session,
      Message, UsageEvent, ApiKeyVault)
- [ ] Clerk project setup (เปิด Organizations feature), env keys ทั้ง 2 ฝั่ง
- [ ] Nginx config เพิ่ม subdomain ใหม่ (เช่น `crew.korvuz.sit`) แยก port จาก InvoiceAI
- [ ] MinIO container + bucket policy ต่อ company prefix

## Phase 1 — Auth & Company
- [ ] FastAPI middleware verify Clerk JWT (`core/security.py`)
- [ ] Sync Clerk Organization -> `Company` table (webhook หรือ on-demand)
- [ ] Onboarding page: create company / select company (ใช้ UI prompt #1)
- [ ] Company switcher ใน sidebar (ถ้า user อยู่หลายบริษัท)

## Phase 2 — Agent & Skill (Library) & Org Chart
- [ ] CRUD `Skill` (markdown editor) — API + UI prompt #3
- [ ] CRUD `Agent` card (level, allowed_providers, skills[]) — API + UI prompt #4
- [ ] `core/llm_router.py`: config table level+provider -> model id จริง
- [ ] Org chart read-only view (derive hierarchy จาก pipeline ที่ผูก agent
      เป็น orchestrator/worker) — UI prompt #2

## Phase 3 — Pipeline (CrewAI integration)
- [ ] `crews/agent_factory.py`: แปลง DB Agent record -> `crewai.Agent`
      (รวม resolve LLM ผ่าน `llm_router`)
- [ ] `crews/pipeline_runner.py`:
      - Orchestrator-Worker -> `Process.hierarchical`
      - Sequential -> `Process.sequential`
- [ ] Pipeline builder UI (form-based ก่อน) — API + UI prompt #5
- [ ] `POST /pipelines/{id}/run` -> queue งาน (Redis) -> return session_id

## Phase 4 — Chat, Realtime, Usage Tracking
- [ ] WebSocket manager (`ws/manager.py`) broadcast event ตาม schema ใน
      architecture.md (agent_start/agent_thought/agent_done/pipeline_done)
- [ ] Hook CrewAI callback/step events -> ส่งเข้า WebSocket แบบ real-time
- [ ] Chat UI (LINE-style) แสดง trace + token/cost/time ต่อ step — UI prompt #6
- [ ] File upload: frontend -> backend -> MinIO -> เก็บ reference ใน `Message`
- [ ] `UsageEvent` insert ทุกครั้งที่ agent call LLM (token, cost, latency)
- [ ] Provider fallback (`crews/fallback.py`): catch rate-limit error ->
      เลือก provider อื่นที่ level เดียวกัน -> retry
- [ ] Budget cap check ก่อนรันแต่ละ agent call (เทียบกับ `Company.budget_limit`)

## Phase 5 — History & Settings
- [ ] History list page (table) — API `/sessions` + UI prompt #7
- [ ] Read-only chat replay (reuse Chat component)
- [ ] Settings: API key vault CRUD (encrypt ด้วย Fernet) — UI prompt #8
- [ ] "Test connection" endpoint ต่อ provider (เรียก minimal request เช็ค key)

## Phase 6 — Polish (ทำทีหลังสุด ไม่ critical)
- [ ] Office visual mode (toggle) — ใช้ event schema เดียวกับ chat — UI prompt #9
- [ ] Agent/Skill template library (เริ่มจาก Customer Support Agent ที่ออกแบบไว้)
- [ ] Notification เมื่อ pipeline รันจบ (ถ้ารันนาน/async)
- [ ] Agent/Skill versioning + rollback

## Out of scope (ตอนนี้)
- RBAC หลาย user ต่อ 1 company (เก็บไว้ก่อน ออกแบบไว้ owner เดียว)
- Visual drag-drop pipeline canvas (ใช้ form-based ใน Phase 3 ก่อน)
