#!/bin/bash
set -eu

repair_file="${1:-scripts/reparar-salud-clinica-faltante.js}"
app_file="${2:-app.js}"

fail() { echo "❌ FAIL: $1"; exit 1; }

grep -q "aGeKaCkjYNy3jOfyouhh" "$repair_file" || fail "Falta limitar la reparación al ID autorizado"
grep -q "salud_separada_version !== 1" "$repair_file" || fail "Falta validar el marcador de migración"
grep -q "El destino salud_clinica ya existe; no se sobrescribió" "$repair_file" || fail "Falta impedir sobrescrituras"
grep -q "verificacion_equivalencia: true" "$repair_file" || fail "Falta verificar equivalencia posterior"
grep -q "aptitud_modificada: false" "$repair_file" || fail "Falta declarar que no se modifica aptitud"
grep -q "campos_legacy_eliminados: false" "$repair_file" || fail "Falta declarar conservación legacy"
grep -q 'REPARAR SALUD_CLINICA' "$app_file" || fail "Falta confirmación exacta en la interfaz"
grep -q "ultimoReporteAuditoriaLimpieza" "$app_file" || fail "Falta limitar la acción al último reporte"

if grep -Eq "deleteField|deleteDoc|batch\.delete|transaction\.delete" "$repair_file"; then
  fail "La reparación contiene una operación de eliminación"
fi

if grep -Eq "aptitudes_ocupacionales|aptitud_ocupacional" "$repair_file"; then
  fail "La reparación intenta acceder a aptitud ocupacional"
fi

echo "✅ PASS: reparación limitada al destino clínico faltante"
