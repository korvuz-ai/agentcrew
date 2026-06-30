# ISSUE.md — Known Issues & Root Causes

## [RESOLVED] UI changes not showing after code edit

**Symptom:** แก้ไฟล์ใน `frontend/` แล้วเปิด http://127.0.0.1:8790 — UI ไม่เปลี่ยน  
**Root cause:** App รันใน Docker image ที่ build ไว้แล้ว — Next.js ไม่ได้ hot-reload จาก host filesystem  
**Fix:** ต้อง rebuild image + force-recreate container ทุกครั้งหลังแก้โค้ด:

```bash
docker compose -f /opt/agent-company/docker-compose.yml build --no-cache frontend
docker compose -f /opt/agent-company/docker-compose.yml up -d --force-recreate frontend
```

**Verify:** ตรวจว่า text ใหม่อยู่ใน bundle จริง:
```bash
docker exec agent-company-frontend sh -c 'grep -rl "YOUR_NEW_TEXT" /app/.next/static/chunks/'
```

---

## [OPEN] Chat — NewSessionDialog toggle ไม่ปรากฏ (pre-rebuild)

**Symptom:** เปิด Chat → New session → ไม่เห็น toggle "Pipeline / Single Agent"  
**Root cause:** ดู issue แรกด้านบน — container ยังใช้ image เก่าก่อนที่จะมีการ rebuild  
**Status:** Resolved หลัง rebuild วันที่ 2026-06-29

---

## [OPEN] PipelineDialog — field "Working directory" ไม่ปรากฏ (pre-rebuild)

**Symptom:** เปิด Pipelines → New/Edit pipeline → ไม่เห็น field "Working directory"  
**Root cause:** เหมือนกับ issue บน  
**Status:** Resolved หลัง rebuild วันที่ 2026-06-29
