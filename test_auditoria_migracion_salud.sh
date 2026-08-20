#!/bin/bash
set -eu

app_file="${1:-app.js}"
html_file="${2:-index.html}"

fail() {
  echo "❌ FAIL: $1"
  exit 1
}

grep -q 'import { migrarSaludLegacy }' "$app_file" || fail "Falta importar la utilidad de migración"
grep -q "migrarSaludLegacy(db, { dryRun: true })" "$app_file" || fail "La auditoría no fuerza dryRun=true"
grep -q "if (!esMedicoOcupacional())" "$app_file" || fail "Falta bloqueo de rol Médico Ocupacional"
grep -q 'id="btnAuditarMigracionSalud"' "$html_file" || fail "Falta botón de auditoría"
grep -q 'id="resultadoAuditoriaSalud"' "$html_file" || fail "Falta panel de resultados"

if grep -q "migrarSaludLegacy(db, { dryRun: false })" "$app_file"; then
  fail "La interfaz no debe habilitar escritura de migración"
fi

echo "✅ PASS: auditoría de migración limitada a DRY_RUN"
