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
grep -q 'id="auditoriaSaludAcciones"' "$html_file" || fail "Falta contenedor de acciones controladas"
grep -q "ultimoReporteAuditoriaSalud" "$app_file" || fail "Falta validar contra el último DRY_RUN"
grep -q 'MIGRAR \${trabajadorId}' "$app_file" || fail "Falta confirmación escrita con ID exacto"
grep -q "migrarSaludLegacy(db, { dryRun: false, trabajadorId })" "$app_file" || fail "Falta límite por trabajadorId"
grep -q "operacion.migrados !== 1" "$app_file" || fail "Falta confirmar exactamente una migración"
grep -q "No repetir; ejecutar un nuevo DRY_RUN" "$app_file" || fail "Falta control ante verificación ambigua"

if grep -q "migrarSaludLegacy(db, { dryRun: false })" "$app_file"; then
  fail "Existe una migración sin trabajadorId"
fi

echo "✅ PASS: auditoría DRY_RUN y escritura limitada a un candidato"
