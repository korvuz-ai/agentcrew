# CLAUDE.md — AgentCrew Platform (ชื่อทำงาน รอเปลี่ยนได้)

## ภาพรวมโปรเจกต์
แพลตฟอร์มสร้างและบริหาร "บริษัท AI agent" — ผู้ใช้สร้าง/เลือกบริษัท, สร้าง agent
เป็นการ์ดเกม (level = LLM tier), ผูก skill จาก library, จัดเป็น pipeline
(Orchestrator-Worker หรือ Pipeline แบบ sequential), คุยงานผ่านแชทที่เห็น
agent คุยกันแบบ real-time พร้อม token/cost/time ทุก step

**โปรเจกต์นี้แยกขาดจาก Agent Office Simulator เดิม** (ไม่ reuse code/repo
แต่แนวคิด event-driven trace อ้างอิงจากที่นั่นได้)

## Tech Stack (final decision)
| ส่วน | เลือกใช้ | เหตุผล |
|---|---|---|
| Agent orchestration | **CrewAI** (Python) | Role-based agent ตรงกับ metaphor "พนักงานบริษัท", รองรับ hierarchical (Orchestrator-Worker) + sequential (Pipeline) process ในตัว, multi-LLM ผ่าน LiteLLM |
| Backend API | **FastAPI** (Python) | ต้องอยู่ runtime เดียวกับ CrewAI |
| Frontend | **Next.js 14 (App Router)** | สอดคล้องกับ InvoiceAI ที่ใช้อยู่ |
| DB | **PostgreSQL** + SQLAlchemy + Alembic | ความสัมพันธ์ company/agent/skill/pipeline ซับซ้อน ต้องใช้ relational |
| Cache/Queue | **Redis** | session, rate-limit, queue สำหรับ pipeline run แบบ async |
| File storage | **MinIO self-host บน VPS เดียวกับ InvoiceAI** | S3-compatible, ไม่ผูก cloud account ใดๆ |
| Auth | **Clerk + Clerk Organizations** | Organizations = company ในตัว, ใช้ข้าม Next.js/FastAPI ได้ |
| Realtime | **WebSocket (FastAPI native)** | broadcast agent trace event ไป frontend |
| LLM providers | Claude, Gemini, GPT — เลือก dynamic ต่อ agent | ผ่าน CrewAI's LiteLLM layer |
| Deploy | Docker Compose บน VPS เดิม, แยก subdomain ผ่าน Nginx | เช่น `crew.korvuz.sit` |

## Data Model หลัก (สรุป)
```
Company (org)
 └─ Agent (name, level 1-3, skills[], allowed_providers[], system_prompt)
 └─ Skill (library item, reusable text/instruction module)
 └─ Pipeline (graph: nodes=agent_id, type=orchestrator|sequential)
 └─ Session (chat thread)
     └─ Message (รวม inter-agent trace event)
     └─ UsageEvent (token, cost, latency ต่อ agent call)
 └─ ApiKeyVault (encrypted, ต่อ company ไม่ใช่ต่อ user)
```

## Decision log (สำคัญ — อ้างอิงตอนเขียนโค้ด)
1. **Level → Model mapping ไม่ hardcode** เก็บเป็น config table ใน DB
   (เปลี่ยนได้เมื่อ provider ออกโมเดลใหม่) ตัวอย่างปัจจุบัน (มิ.ย. 2026):
   - Level 1 (Junior): Claude Haiku 4.5 / Gemini 3.1 Flash-Lite / GPT-5.5 Instant
   - Level 2 (Mid): Claude Sonnet 4.6 / Gemini 3.1 Pro / GPT-5.5
   - Level 3 (Senior): Claude Opus 4.8 / Gemini 3.1 Pro (Deep Think) / GPT-5.5 Pro
2. **File upload ไม่มี local path** — เก็บ MinIO ต่อ `company_id/session_id/`,
   agent เห็นแค่ file reference/signed URL ไม่เห็น path เครื่องจริง
3. **API key เก็บต่อ company** (encrypt ด้วย Fernet, master key จาก env)
   ไม่เก็บต่อ user เพื่อแยก billing ชัดถ้าจะขายเป็น SaaS วันหน้า
4. **Fallback provider**: ถ้า agent เรียก provider ที่กำหนดแล้วโดน rate-limit
   ให้สลับไป provider อื่นที่ level เดียวกันอัตโนมัติ (ดีเทลอยู่ใน TASKS.md Phase 4)
5. **Budget cap ต่อ company** ป้องกัน agent loop ผิดพลาดแล้ว cost บวม

## สิ่งที่ยังไม่ตัดสินใจ (รอ phase ถัดไป)
- Pipeline builder UI: visual drag-drop เทียบ form-based list (form ก่อนสำหรับ MVP)
- RBAC ระดับ user ใน 1 company (ตอนนี้ design ไว้ owner เดียวก่อน)
