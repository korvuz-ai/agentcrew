# AgentCrew — Backlog

อัปเดต: 2026-06-29
อ่าน DEBUG.md สำหรับ file map / DB schema / commands ทั้งหมด

---

## ✅ Done

### Frontend UI (localStorage-based, ทุก phase)
- [x] Sidebar + layout (phase lock phase > 6)
- [x] Agents page — AgentCard, AgentDialog (create/edit/delete), org chart tree view
- [x] Skill Library — SkillCard, SkillDialog (create/edit/delete)
- [x] Pipelines — PipelineCard, PipelineDialog (type toggle, cwd field, node list)
- [x] Chat — NewSessionDialog (mode toggle Pipeline / Single Agent), ChatBubble, session list
- [x] History — session list + replay
- [x] Office — visual floor plan, AgentDesk states (idle/thinking/working/talking), zone layout จาก managerId hierarchy
- [x] Org Chart — tree view จาก managerId
- [x] Settings — provider API keys, budget cap
- [x] Seeds — 13 agents, 25 skills, demo pipelines/sessions (SEED_VERSION v5)

### Backend
- [x] **B0** — FastAPI scaffold, `/api/health` (DB SELECT 1), CORS, Docker Compose (5 containers), Nginx config
- [x] **B1** — SQLAlchemy async models (9 tables), Alembic init, migration 0001 + 0002, entrypoint auto-migrate
- [x] **B2** — Clerk webhook `/api/webhooks/clerk` (Svix verify + org upsert, idempotent), `get_current_company()` JWT dependency (unused by routes yet)

---

## 🔲 Backlog

### B3 — CRUD API Routes
*depends on: B1 ✅*
*frontend swap: ใช้ API แทน localStorage หลัง B3 เสร็จ*

- [ ] `GET/POST /api/companies/{company_id}/agents`
- [ ] `GET/PATCH/DELETE /api/companies/{company_id}/agents/{id}`
- [ ] `GET/POST /api/companies/{company_id}/skills`
- [ ] `GET/PATCH/DELETE /api/companies/{company_id}/skills/{id}`
- [ ] `GET/POST /api/companies/{company_id}/pipelines`
- [ ] `GET/PATCH/DELETE /api/companies/{company_id}/pipelines/{id}`
  - [ ] nested: sync pipeline nodes (replace all on PATCH)
- [ ] `GET/POST /api/companies/{company_id}/sessions`
- [ ] `GET/DELETE /api/companies/{company_id}/sessions/{id}`
- [ ] `GET /api/companies/{company_id}/sessions/{id}/messages`
- [ ] Auth: ไม่ inject `get_current_company` ก่อน — ใส่ `# TODO: auth` ไว้ รอ license key system
- [ ] Frontend: swap localStorage hooks → fetch calls (ทีละ hook)

### B4 — CrewAI Pipeline Runner
*depends on: B3 ✅*

- [ ] uncomment `crewai`, `litellm` ใน requirements.txt
- [ ] `app/crews/agent_factory.py` — แปลง DB Agent → `crewai.Agent` (resolve level → model ผ่าน config table)
- [ ] `app/crews/pipeline_runner.py`
  - [ ] Sequential → `Process.sequential`
  - [ ] Orchestrator-Worker → `Process.hierarchical`
- [ ] `POST /api/companies/{company_id}/pipelines/{id}/run` → queue Redis → return session_id
- [ ] `UsageEvent` insert ทุก agent call (tokens_in, tokens_out, cost_usd, latency_ms)
- [ ] Config table: `level_model_map` (level 1-3 × provider) — เก็บใน DB ไม่ hardcode

### B5 — WebSocket Real-time
*depends on: B4 ✅*

- [ ] `app/ws/manager.py` — ConnectionManager (register/unregister/broadcast ต่อ session_id)
- [ ] `WS /ws/sessions/{session_id}` — client subscribe
- [ ] Hook CrewAI step callbacks → broadcast events:
  - `agent_start` `{agent_id, name}`
  - `agent_thought` `{agent_id, content}`
  - `agent_done` `{agent_id, output, tokens, cost_usd, latency_ms}`
  - `pipeline_done` `{session_id, total_cost_usd}`
- [ ] Frontend Chat: connect WebSocket → render trace events real-time
- [ ] Frontend Office: connect WebSocket → update AgentDesk state จาก events จริง (แทน simulation)

### B6 — File Upload (MinIO)
*depends on: B3 ✅*

- [ ] `POST /api/companies/{company_id}/sessions/{id}/files` → upload → MinIO `{company_id}/{session_id}/{filename}`
- [ ] Return signed URL (valid 1h) ให้ agent เข้าถึงไฟล์
- [ ] เก็บ file reference ใน `Message.content` (ไม่เก็บ local path)
- [ ] Frontend Chat: file input → upload before send → attach reference ใน message

### B7 — ApiKeyVault Encryption
*depends on: B3 ✅*

- [ ] uncomment `cryptography` ใน requirements.txt
- [ ] `app/core/encryption.py` — Fernet encrypt/decrypt ใช้ `FERNET_MASTER_KEY`
- [ ] `GET/PUT /api/companies/{company_id}/api-keys/{provider}` — store encrypted key
- [ ] `GET /api/companies/{company_id}/api-keys/{provider}/test` — decrypt → test call → return ok/error
- [ ] Frontend Settings: swap hardcoded localStorage keys → API calls

### B8 — Budget Cap + Provider Fallback
*depends on: B4 ✅, B7 ✅*

- [ ] `app/crews/fallback.py` — catch rate-limit → สลับ provider อื่นที่ level เดียวกัน → retry
- [ ] Budget check ก่อน agent call: `sum(cost_usd) < company.budget_cap`
- [ ] Redis counter ต่อ company สำหรับ rate-limit tracking
- [ ] Frontend: แสดง alert เมื่อ budget ถึง threshold (80% default)

### BX — License Key System (LAST — หลังทุกอย่างเสร็จ)
*depends on: B1 ✅, B7 ✅*

- [ ] สร้าง table `license_keys` (company_id FK, key_hash, issued_at, expires_at?)
- [ ] `POST /api/admin/companies/{id}/generate-key` — gen random bytes → Fernet encrypt → store hash → return plaintext key (แสดงครั้งเดียว)
- [ ] Auth middleware ใหม่: `get_company_by_license_key(key: str)` → decrypt/verify → return Company
- [ ] Swap `# TODO: auth` ใน B3 routes → ใช้ license key dep แทน (หรือ layer บน Clerk)
- [ ] Frontend: settings หน้าจัดการ license key

---

## 📋 Notes

**Order ที่แนะนำ:** B3 → B7 → B4 → B5 → B6 → B8 → BX
- B7 ก่อน B4 เพราะ runner ต้องการ API keys จาก vault
- B5 ทำได้เฉพาะหลัง B4 เพราะต้อง hook CrewAI callbacks

**Frontend swap timing:**
- แต่ละ hook ใน `store.ts` swap ได้ทีละตัวหลัง route นั้นใน B3 พร้อม
- ไม่ต้อง swap ทีเดียวทุกอย่าง

**Auth pattern สำหรับ B3:**
- ใช้ `company_id` เป็น path param ก่อน (ไม่ verify identity)
- เพิ่ม auth dep หลังจาก BX เสร็จ
