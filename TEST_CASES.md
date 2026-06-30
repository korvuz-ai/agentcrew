# Test Cases — AgentCrew Backend

สำหรับ test B3–B5 ตาม backend flow  
ใช้ company ID จริงจาก DB: `5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291`

---

## Setup ก่อน test

```bash
# ดู logs backend แบบ real-time
docker compose logs -f backend

# เปิด logs ใน terminal แยก แล้วค่อย test

# ตรวจสอบ API keys ใน vault
docker compose exec postgres psql -U postgres -d agentcrew -c \
  "SELECT provider FROM api_key_vault WHERE company_id='5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291';"

# ตรวจสอบ agents + providers
docker compose exec postgres psql -U postgres -d agentcrew -c \
  "SELECT name, level, providers FROM agents WHERE company_id='5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291';"
```

---

## TC-01 — Health Check

**ทดสอบ:** Backend ขึ้นและ connect DB ได้

```bash
curl -s http://127.0.0.1:8791/api/health | python3 -m json.tool
```

**Expected:**
```json
{"status": "ok", "version": "0.1.0", "env": "production", "db": "ok"}
```

---

## TC-02 — API Keys: Save + Retrieve

**ทดสอบ:** บันทึก API key ผ่าน Settings แล้ว backend encrypt เก็บได้

```bash
CID=5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291

# Check key exists
curl -s http://127.0.0.1:8791/api/companies/$CID/api-keys/claude

# Test key validity (decrypt + test call)
curl -s http://127.0.0.1:8791/api/companies/$CID/api-keys/claude/test
```

**Expected:**
```json
// exists:
{"exists": true}

// test:
{"ok": true, "provider": "claude"}
```

**Fail cases:**
- `{"exists": false}` → ไปที่ Settings → ใส่ API key → Save → ลอง test ใหม่
- `{"ok": false, "error": "..."}` → key ผิด หรือ quota หมด

---

## TC-03 — B3: Single Agent Chat — ส่งข้อความ

**ทดสอบ:** POST /sessions/{id}/chat → backend บันทึก user msg + kick off background task

**ขั้นตอน:**
1. ไปที่ Chat → New Session → เลือก Agent mode → เลือก agent → เลือก provider → Create
2. พิมพ์ข้อความ เช่น "สวัสดี บอกชื่อตัวเองมาหน่อย"
3. กด Enter

**Expected (UI):**
- ข้อความ user ปรากฏทันที
- มีจุด thinking / indicator หลังส่ง
- Agent ตอบกลับมาภายใน 5–30 วินาที
- ข้อความ agent มี icon/avatar และ cost แสดง

**Expected (backend logs):**
```
INFO: POST /api/companies/.../sessions/.../chat
INFO: [agent_chat] starting for session ...
INFO: [agent_chat] provider=claude model=claude-sonnet-4-6
INFO: [agent_chat] done tokens=... cost=...
```

**Expected (DB):**
```sql
SELECT role, content, agent_id, tokens_in, cost_usd
FROM messages
WHERE session_id='<session_id>'
ORDER BY created_at;
-- ต้องมี 2 rows: role=user และ role=assistant
```

---

## TC-04 — B3: Single Agent Chat — ประวัติการสนทนา

**ทดสอบ:** Agent จำการสนทนาก่อนหน้าได้ (conversation history)

**ขั้นตอน:**
1. ส่งข้อความแรก: "ชื่อของฉันคือ Alice"
2. รอ agent ตอบ
3. ส่งข้อความ: "ชื่อฉันคืออะไร?"

**Expected:**
- Agent ตอบว่า "Alice" (ไม่ใช่ไม่รู้)

---

## TC-05 — B3: Provider Selector

**ทดสอบ:** เลือก provider ได้ตอน create session

**ขั้นตอน:**
1. New Session → Agent mode
2. dropdown Provider เลือก "Gemini"
3. Create + ส่งข้อความ

**Expected (logs):**
```
INFO: [agent_chat] provider=gemini model=gemini/gemini-2.5-flash
```

---

## TC-06 — B4: Pipeline Run — Basic

**ทดสอบ:** รัน pipeline ที่มี 2+ agents และได้ผลลัพธ์ครบ

**ขั้นตอน:**
1. ไปที่ Chat → New Session → Pipeline mode
2. เลือก pipeline → เลือก provider
3. ใส่ task เช่น "สรุปกลยุทธ์ content marketing สั้นๆ 3 จุด"
4. Create (pipeline รันทันที)

**Expected (UI):**
- Session status = running (สีเหลือง pulse)
- ข้อความแต่ละ agent ปรากฏ ทีละตัวตามลำดับ
- แต่ละข้อความมี icon ของ agent คนนั้น (ไม่ใช่ icon เดียวกันหมด)
- หลัง pipeline จบ → status = completed (สีเขียว)
- Input bar ยังเปิดอยู่ (ไม่ปิด)

**Expected (DB):**
```sql
SELECT m.role, m.content, a.name as agent_name
FROM messages m
LEFT JOIN agents a ON a.id = m.agent_id
WHERE m.session_id='<session_id>'
ORDER BY m.created_at;
-- ต้องมี message ของแต่ละ agent แยกกัน ไม่รวมเป็น 1 row
```

---

## TC-07 — B4: Pipeline Run — Multiple Agent Messages

**ทดสอบ:** แต่ละ agent save message แยก (ไม่ใช่ 1 message รวม)

```bash
# หลัง pipeline รัน
docker compose exec postgres psql -U postgres -d agentcrew -c \
  "SELECT a.name, m.role, LEFT(m.content, 80) as preview
   FROM messages m
   JOIN agents a ON a.id = m.agent_id
   WHERE m.session_id='<session_id>' AND m.role='assistant'
   ORDER BY m.created_at;"
```

**Expected:** หลาย rows แต่ละ row มี agent name ต่างกัน

---

## TC-08 — B4: Provider Fallback — 503/Rate Limit

**ทดสอบ:** ถ้า provider หลักโดน 503 → สลับ provider อื่นอัตโนมัติ

**ขั้นตอน:**
1. รัน pipeline โดยเลือก Gemini (ที่มักโดน 503 ช่วง peak)
2. ดู backend logs

**Expected (logs) เมื่อ Gemini โดน 503:**
```
WARNING: [pipeline] provider gemini failed: ServiceUnavailableError 503
INFO: [pipeline] marking gemini rate-limited (60s)
INFO: [pipeline] rebuilding agents with skip=['gemini']
INFO: [pipeline] retry attempt 2 with provider=claude
```

**Expected (UI):**
- Pipeline ยังรันต่อได้ (ไม่ crash)
- ผลลัพธ์ปกติ แค่ใช้ provider อื่น

---

## TC-09 — B5: WebSocket — เชื่อมต่อ

**ทดสอบ:** WS connect ได้ผ่าน nginx → backend

```bash
# Test WS upgrade directly to backend
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" \
  http://127.0.0.1:8791/ws/sessions/test-session-id

# Test via nginx (production)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" \
  https://agents.korvuz.site/ws/sessions/test-session-id
```

**Expected:**
```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: upgrade
```

---

## TC-10 — B5: WebSocket — Real-time Events

**ทดสอบ:** WS events ถูก broadcast ระหว่าง pipeline run

**ขั้นตอน:**
1. เปิด browser DevTools → Network → WS tab
2. รัน pipeline
3. ดู frames ที่รับมา

**Expected frames (ตามลำดับ):**
```json
{"type": "agent_start", "agent_id": "..."}
{"type": "agent_thought", "content": "..."}   // อาจมีหลาย frames
{"type": "agent_done", "agent_id": "...", "output": "...", "cost_usd": 0.001}
// ... repeat per agent ...
{"type": "pipeline_done", "status": "completed", "total_cost_usd": 0.005}
```

---

## TC-11 — Agent Filesystem Tools (CWD)

**ทดสอบ:** Pipeline ที่ตั้ง Working Directory → agents เข้าถึง files ได้

**ขั้นตอน:**
1. Pipelines → Edit pipeline → ใส่ Working Directory `/opt/agent-company`
2. รัน pipeline ด้วย task: "list what files are in the root directory"

**Expected:**
- Agent output พูดถึง files ใน `/opt/agent-company` (README.md, docker-compose.yml, etc.)
- ไม่มี error เรื่อง tool

**Expected (logs):**
```
INFO: [tools] make_cwd_tools('/opt/agent-company') → 4 tools
```

---

## TC-12 — Status Dot Colors

**ทดสอบ:** สีของ status dot ถูกต้อง

| สถานะ | สีที่ต้องแสดง |
|-------|-------------|
| Active agent session (ยังไม่ได้ส่งอะไร) | เทา (neutral-400) |
| Pipeline กำลังรัน | เหลือง pulse |
| Pipeline/session เสร็จแล้ว | เขียว |
| Session มี error | แดง |

---

## TC-13 — Chat Input ไม่ปิดหลัง Pipeline จบ

**ทดสอบ:** หลัง pipeline complete แล้ว input bar ยังพิมพ์ได้

**ขั้นตอน:**
1. รัน pipeline รอจน complete
2. ลองพิมพ์ข้อความใน input bar

**Expected:** พิมพ์ได้ (ไม่ disabled)

---

## TC-14 — Session History

**ทดสอบ:** เปิด History → เห็น sessions เก่าพร้อม messages

**ขั้นตอน:**
1. รัน pipeline 1 ครั้ง
2. ไปที่ History

**Expected:**
- Session ปรากฏ พร้อม total cost
- กด session เห็น messages ครบ

---

## TC-15 — Budget Alert

**ทดสอบ:** WS emit `budget_alert` เมื่อ cost ใกล้ cap

**Setup:**
```bash
# Set budget cap ต่ำๆ เพื่อ test
docker compose exec postgres psql -U postgres -d agentcrew -c \
  "UPDATE companies SET budget_cap_usd=0.001 WHERE id='5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291';"
```

**รัน pipeline แล้วดู WS frames:**
```json
{"type": "budget_alert", "spend_usd": 0.001, "cap_usd": 0.001, "pct_used": 100}
```

**Cleanup:**
```bash
docker compose exec postgres psql -U postgres -d agentcrew -c \
  "UPDATE companies SET budget_cap_usd=10.0 WHERE id='5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291';"
```

---

## Quick DB Queries สำหรับ verify

```sql
-- Sessions ล่าสุด
SELECT id, name, status, total_cost_usd, created_at
FROM sessions
WHERE company_id='5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291'
ORDER BY created_at DESC LIMIT 10;

-- Messages ของ session ล่าสุด
SELECT m.role, a.name as agent, LEFT(m.content,100) as preview, m.cost_usd
FROM messages m
LEFT JOIN agents a ON a.id = m.agent_id
WHERE m.session_id=(
  SELECT id FROM sessions
  WHERE company_id='5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291'
  ORDER BY created_at DESC LIMIT 1
)
ORDER BY m.created_at;

-- Usage events (token/cost breakdown)
SELECT agent_id, provider, model, tokens_in, tokens_out, cost_usd, latency_ms
FROM usage_events
WHERE session_id=(
  SELECT id FROM sessions
  WHERE company_id='5dc4a8c5-2eb8-4ad0-a1f2-9f477c397291'
  ORDER BY created_at DESC LIMIT 1
);

-- Rate limit keys ใน Redis
docker compose exec redis redis-cli KEYS "ratelimit:*"
```
