# Bug Log — AgentCrew

บันทึก bug ที่เจอระหว่าง testing พร้อมวิธีแก้

---

## B4 / B5 — Pipeline Run

### BUG-001 — Pipeline ไม่ run เพราะ user ใช้ Single Agent mode
**อาการ:** กด Start session แล้ว "Pipeline is running…" ค้าง หรือส่ง message แล้วไม่มีอะไรเกิดขึ้น
**สาเหตุ:** NewSessionDialog มี 2 tab: "Pipeline" และ "Single Agent" — Single Agent mode แค่เก็บ message ไม่ได้รัน CrewAI
**วิธีแก้:**
- เลือก tab **Pipeline** (ซ้าย) ใน New Session dialog
- เลือก pipeline จาก dropdown
- ใส่ **Task description** (required) เช่น "Write a blog post about AI agents"
- กด Start session → status dot สีเหลืองวิ่ง = pipeline กำลัง run

---

### BUG-002 — Single-agent session ค้างที่ status "running"
**อาการ:** Session ที่สร้างใน Single Agent mode แสดง status "running" ตลอดไม่เคยเปลี่ยน
**สาเหตุ:** frontend ส่ง `status: "running"` ไปกับ POST /sessions ทั้งที่ single-agent session ไม่มี background runner
**วิธีแก้ (code):** เปลี่ยนเป็น `status: "active"` ใน `chat/page.tsx` handleCreate (แก้แล้วใน session นี้)
**วิธีแก้ (data):** `UPDATE sessions SET status = 'active' WHERE pipeline_id IS NULL AND status = 'running';`

---

## B7 — API Key Vault

### BUG-003 — Gemini test model ID ผิด (`-001` suffix)
**อาการ:** กด Test button ใน Settings → `litellm.NotFoundError: models/gemini-3.1-flash-lite-001 is not found`
**สาเหตุ:** `_TEST_MODEL` ใน `routers/api_keys.py` ใช้ `gemini/gemini-3.1-flash-lite-001` ซึ่ง API ไม่รู้จัก
**วิธีแก้:** เปลี่ยนเป็น `gemini/gemini-3.1-flash-lite` (ไม่มี `-001`) — แก้แล้ว

### BUG-004 — level_model_map มี Gemini model ID ผิด
**อาการ:** Run pipeline แล้ว `gemini-3.1-flash-lite-001 is not found`
**สาเหตุ:** `level_model_map` table ใน DB ใช้ `-001` suffix ที่ไม่มีจริง
**วิธีแก้:** UPDATE ใน DB:
```sql
UPDATE level_model_map SET model_id = 'gemini/gemini-3.1-flash-lite'  WHERE provider='gemini' AND level=1;
UPDATE level_model_map SET model_id = 'gemini/gemini-2.5-flash-lite'  WHERE provider='gemini' AND level=2;
UPDATE level_model_map SET model_id = 'gemini/gemini-3.1-pro-preview' WHERE provider='gemini' AND level=3;
```

---

## B4 — CrewAI Runner

### BUG-007 — Chat area ว่างเมื่อเลือก session — messages ไม่ refresh จาก DB
**อาการ:** คลิก session ในซ้ายบาร์แล้ว chat area ว่างเปล่า (แม้ pipeline จะ completed แล้ว)
**สาเหตุ:** `useSessions` โหลด sessions ครั้งเดียวตอน mount — pipeline runner เพิ่ม messages ใน DB ทีหลัง แต่ frontend state ไม่ update
**วิธีแก้:** เพิ่ม `refreshSession(id)` ใน store + `useEffect` บน `selectedId` change เพื่อ fetch latest messages ทุกครั้งที่เลือก session — แก้แล้ว

---

### BUG-005 — Gemini 503 "high demand" ระหว่าง run
**อาการ:** Pipeline run ล้มเหลว `litellm.ServiceUnavailableError: VertexAIException 503 - high demand`
**สาเหตุ:** Gemini API overloaded ชั่วคราว และ agent ถูก route ไป Gemini เพราะไม่มี Claude key ใน vault
**วิธีแก้:**
1. เพิ่ม Claude API key ใน Settings → vault → agent ที่มี `providers: ["claude","gemini"]` จะ switch ไป Claude อัตโนมัติ
2. หรือรอแล้วลองใหม่ (503 เป็น transient)
**หมายเหตุ:** provider fallback (B8) จะ mark Gemini ใน Redis 60s แล้วลอง provider อื่น — แต่ถ้ามีแค่ Gemini key เดียว จะยังล้มอยู่

---

## Seed / Data

### BUG-006 — Seed script ลืมใส่ avatar field
**อาการ:** Agents ไม่มีรูปหลัง seed ลง DB
**วิธีแก้:** `UPDATE agents SET avatar = CASE name WHEN 'Fiona' THEN 'CEO-Fi.png' ... END;` — แก้แล้ว

---

## Notes สำหรับ test ครั้งต่อไป

- ใส่ **Claude key** ใน vault ก่อน run pipeline — Claude เสถียรกว่า Gemini ในช่วง high traffic
- ตรวจ session status ใน DB: `SELECT name, status, pipeline_id FROM sessions ORDER BY created_at DESC LIMIT 5;`
- ดู backend log real-time: `docker compose logs -f backend 2>&1 | grep -v GET`
- Pipeline run endpoint: `POST /api/companies/{cid}/pipelines/{pid}/run` — ถ้า log ไม่เห็น endpoint นี้ แปลว่า frontend ยังใช้ Single Agent mode
