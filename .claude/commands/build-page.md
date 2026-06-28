---
description: Build one UI page from ui-prompts.md by page number
argument-hint: <page-number 1-9>
---

อ่าน CLAUDE.md และ architecture.md ก่อนเสมอ (ถ้ายังไม่ได้อ่านใน session นี้)
จากนั้นเปิด ui-prompts.md หา prompt หมายเลข $ARGUMENTS แล้ว implement หน้านั้น
ใน frontend/ ตาม path ที่ระบุไว้ใน architecture.md > Project structure

ขั้นตอน:
1. Implement component/page ตาม prompt ที่เจอ
2. ใส่ header comment "Purpose: ..." ที่ไฟล์ใหม่ทุกไฟล์ตามกฎใน CONVENTIONS.md
3. รัน `npm run build` ใน frontend/ เช็คว่า build ผ่านไม่มี error
4. รัน `bash scripts/gen-structure-map.sh` เพื่อ update STRUCTURE.md
5. สรุปสั้นๆว่าไฟล์ไหนถูกสร้าง/แก้ไปบ้าง
