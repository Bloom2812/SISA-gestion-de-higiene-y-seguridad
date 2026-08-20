#!/bin/bash
set -eu
migration_file="${1:-scripts/migrar-salud-legacy.js}"
fail() { echo "❌ FAIL: $1"; exit 1; }
grep -q "dryRun = true" "$migration_file" || fail "DRY_RUN no es el valor predeterminado"
grep -q "salud_clinica" "$migration_file" || fail "Falta destino salud_clinica"
grep -q "aptitudes_ocupacionales" "$migration_file" || fail "Falta destino aptitudes_ocupacionales"
grep -q "conflictos" "$migration_file" || fail "Falta reporte de conflictos"
grep -q "writeBatch" "$migration_file" || fail "Falta escritura atómica"
if grep -q "deleteField" "$migration_file"; then
  fail "La primera fase no debe eliminar campos legacy"
fi
echo "✅ PASS: controles estáticos de migración presentes"
