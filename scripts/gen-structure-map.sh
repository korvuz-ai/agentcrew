#!/usr/bin/env bash
# scripts/gen-structure-map.sh
# สร้าง STRUCTURE.md จาก header comment ("Purpose: ...") ของทุกไฟล์ในโปรเจกต์
# อย่าแก้ STRUCTURE.md มือ — รันสคริปต์นี้ใหม่แทนเสมอ

set -e
OUT="STRUCTURE.md"
echo "# STRUCTURE.md (auto-generated โดย scripts/gen-structure-map.sh — อย่าแก้มือ)" > "$OUT"
echo "" >> "$OUT"

find . \
  -path "*/node_modules" -prune -o \
  -path "*/.git" -prune -o \
  -path "*/.next" -prune -o \
  -path "*/__pycache__" -prune -o \
  -path "*/venv" -prune -o \
  -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \) -print |
sort |
while read -r file; do
  purpose=$(grep -m1 "Purpose:" "$file" 2>/dev/null | sed 's/.*Purpose: *//')
  if [ -n "$purpose" ]; then
    echo "- \`${file#./}\` — $purpose" >> "$OUT"
  fi
done

echo "generated $OUT"
