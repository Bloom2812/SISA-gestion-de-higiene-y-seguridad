#!/bin/bash
set -eu

app_file="${1:-app.js}"
html_file="${2:-index.html}"

fail() { echo "❌ FAIL: $1"; exit 1; }

temporales=(
  scripts/migrar-salud-legacy.js
  scripts/auditar-limpieza-salud-legacy.js
  scripts/reparar-salud-clinica-faltante.js
  scripts/limpiar-salud-legacy-controlado.js
)

for archivo in "${temporales[@]}"; do
  [ ! -e "$archivo" ] || fail "Persistió una herramienta temporal: $archivo"
done

if grep -Eq "migrarSaludLegacy|auditarLimpiezaSaludLegacy|repararSaludClinicaFaltante|limpiarSaludLegacyControlado|EXPEDIENTE_REPARABLE|EXPEDIENTES_LIMPIABLES|LIMPIAR LEGACY|REPARAR SALUD_CLINICA" "$app_file"; then
  fail "app.js conserva código administrativo legacy"
fi

if grep -Eq "btnAuditarMigracionSalud|btnAuditarLimpiezaSalud|resultadoAuditoriaSalud|auditoriaSaludSalida|auditoriaSaludAcciones" "$html_file"; then
  fail "index.html conserva controles administrativos legacy"
fi

echo "✅ PASS: herramientas temporales de Salud retiradas"