# CONVENTIONS.md — กฎจัดโครงสร้างไฟล์

เป้าหมาย: เวลา error ขึ้นมา เปิดไฟล์ที่ traceback บอกแล้วรู้ทันทีว่าใช่/ไม่ใช่
ไฟล์ที่ต้องแก้ — ไม่ต้องให้ Claude เปิดอ่านทั้งโปรเจกต์ทุกครั้ง

## กฎหลัก: 1 ไฟล์ = 1 หน้าที่
- `api/*.py` (route) — รับ request/ตอบ response เท่านั้น **ห้ามมี business logic**
- `services/*.py` — business logic ของ 1 entity ต่อไฟล์ (เช่น `agent_service.py`
  จัดการเฉพาะเรื่อง agent ไม่ปนเรื่อง skill)
- `models/*.py` — SQLAlchemy model, 1 entity ต่อไฟล์
- ไฟล์ไหนเกิน ~200 บรรทัด ให้แตกเป็นไฟล์ย่อยในโฟลเดอร์เดียวกัน
  (เช่น `pipeline_runner.py` ยาวไป แตกเป็น `pipeline_runner_hierarchical.py`
  + `pipeline_runner_sequential.py`)

## Naming
- Backend: `<entity>_<layer>.py` เช่น `agent_router.py`, `agent_service.py`
- Frontend: 1 component = 1 ไฟล์ ชื่อไฟล์ = ชื่อ component (PascalCase)

## Header ทุกไฟล์ต้องมีบรรทัดแรก
```python
"""
Purpose: <สรุป 1 บรรทัดว่าไฟล์นี้ทำอะไร>
Used by: <ไฟล์/route ที่เรียกไฟล์นี้>
"""
```
```ts
// Purpose: <สรุป 1 บรรทัด>
// Used by: <component/page ที่เรียกใช้>
```

## STRUCTURE.md = แผนที่โปรเจกต์
รัน `bash scripts/gen-structure-map.sh` ทุกครั้งที่เพิ่ม/ลบไฟล์ — ไฟล์นี้ดึง
บรรทัด "Purpose:" จาก header มาทำ index รวม Claude Code จะอ่าน STRUCTURE.md
แทนการ list/grep ทั้ง repo เวลาหาว่าควรแก้ไฟล์ไหน (สั่งไว้ใน CLAUDE.md แล้ว)

## ทำให้อัตโนมัติ (ไม่ต้องสั่งเองทุกครั้ง)
เพิ่ม hook ใน `.claude/settings.json` ให้รัน script นี้อัตโนมัติทุกครั้งที่มีการ
เขียน/แก้ไฟล์ใหม่ ไม่ต้องพึ่งให้ Claude จำเอง:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "bash scripts/gen-structure-map.sh" }
        ]
      }
    ]
  }
}
```
