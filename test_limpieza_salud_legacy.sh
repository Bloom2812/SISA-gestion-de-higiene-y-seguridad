#!/bin/bash
set -eu

cleanup_file="${1:-scripts/limpiar-salud-legacy-controlado.js}"
app_file="${2:-app.js}"

fail() { echo "❌ FAIL: $1"; exit 1; }

grep -q "UTiuMsznoFC6dkggaGwu" "$cleanup_file" || fail "Falta el primer ID autorizado"
grep -q "aGeKaCkjYNy3jOfyouhh" "$cleanup_file" || fail "Falta el segundo ID autorizado"
grep -q "salud_separada_version !== 1" "$cleanup_file" || fail "Falta validar marcador"
grep -q "camposEquivalentes(trabajador, salud" "$cleanup_file" || fail "Falta comparar salud clínica"
grep -q "camposEquivalentes(trabajador, aptitud" "$cleanup_file" || fail "Falta comparar aptitud"
grep -q "transaction.update(trabajadorRef" "$cleanup_file" || fail "La limpieza no se limita al trabajador"
grep -q "deleteField()" "$cleanup_file" || fail "Falta eliminación explícita de campos"
grep -q "documento_trabajador_eliminado: false" "$cleanup_file" || fail "Falta declarar conservación del trabajador"
grep -q "salud_clinica_conservada: true" "$cleanup_file" || fail "Falta verificar conservación clínica"
grep -q "aptitud_ocupacional_conservada: true" "$cleanup_file" || fail "Falta verificar conservación de aptitud"
grep -q "detectó cambios en salud_clinica" "$cleanup_file" || fail "Falta verificación clínica posterior"
grep -q "detectó cambios en aptitudes_ocupacionales" "$cleanup_file" || fail "Falta verificación de aptitud posterior"
grep -q 'LIMPIAR LEGACY' "$app_file" || fail "Falta confirmación exacta"
grep -q "ultimoReporteAuditoriaLimpieza" "$app_file" || fail "Falta limitar al último reporte"

if grep -Eq "deleteDoc|transaction\.delete|batch\.delete" "$cleanup_file"; then
  fail "La limpieza contiene eliminación de documentos"
fi

if grep -Eq "transaction\.(set|update)\((saludRef|aptitudRef)" "$cleanup_file"; then
  fail "La limpieza modifica un documento separado"
fi

echo "✅ PASS: limpieza limitada a campos legacy verificados"
