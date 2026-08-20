#!/bin/bash
set -eu

audit_file="${1:-scripts/auditar-limpieza-salud-legacy.js}"
app_file="${2:-app.js}"
html_file="${3:-index.html}"

fail() { echo "❌ FAIL: $1"; exit 1; }

grep -q "AUDITORIA_LIMPIEZA_SOLO_LECTURA" "$audit_file" || fail "Falta modo explícito de solo lectura"
grep -q "listos_para_limpieza" "$audit_file" || fail "Falta lista de expedientes equivalentes"
grep -q "campos_diferentes" "$audit_file" || fail "Falta bloqueo por diferencias"
grep -q "destinos_faltantes" "$audit_file" || fail "Falta bloqueo por destinos ausentes"
grep -q "salud_separada_version !== 1" "$audit_file" || fail "Falta validar marcador de migración"
grep -q 'id="btnAuditarLimpiezaSalud"' "$html_file" || fail "Falta botón de auditoría de limpieza"
grep -q "auditarLimpiezaSaludLegacy(db)" "$app_file" || fail "Falta conectar la auditoría"

if grep -Eq "deleteField|writeBatch|setDoc|updateDoc|deleteDoc" "$audit_file"; then
  fail "La auditoría de limpieza contiene una operación de escritura"
fi

echo "✅ PASS: auditoría de limpieza legacy es de solo lectura"
