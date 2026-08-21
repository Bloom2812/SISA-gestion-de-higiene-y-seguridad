#!/usr/bin/env bash
set -euo pipefail

fail() { echo "❌ FAIL: $1" >&2; exit 1; }

grep -q 'id="page-riesgos"' index.html || fail "Falta la página de Riesgos"
grep -q 'id="r_metodologia"' index.html || fail "Falta el selector de método"
grep -q 'value="Matriz 5x5"' index.html || fail "Falta la Matriz 5x5"
grep -q 'value="JSA 5x5"' index.html || fail "Falta JSA/JHA"
grep -q 'value="NTP 330"' index.html || fail "Falta NTP 330"
grep -q 'id="riskPanelNtp"' index.html || fail "Falta el formulario NTP 330"
grep -q 'id="riskFilterMethod"' index.html || fail "Falta el filtro por método"
grep -q 'function prioridad5x5' app.js || fail "Falta el cálculo 5x5"
grep -q 'function prioridadNtp330' app.js || fail "Falta el cálculo NTP 330"
grep -q "return data.metodologia || 'Legacy 10x10'" app.js || fail "Falta compatibilidad legacy"
if grep -A140 "const coleccionRiesgos" app.js | grep -q "deleteDoc"; then fail "El módulo conserva un borrado permanente"; fi

echo "OK: módulo multimetodología de Riesgos presente"
