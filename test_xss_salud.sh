#!/bin/bash
set -eu
app_file="${1:-app.js}"
fail() { echo "❌ FAIL: $1"; exit 1; }
grep -q "function escapeHtml" "$app_file" || fail "Falta escapeHtml"
grep -q "function urlImagenSegura" "$app_file" || fail "Falta validación de imagen"
if grep -q '<h3>\${t.nombres} \${t.apellidos}</h3>' "$app_file"; then fail "Nombre sin escapar"; fi
if grep -q '<td>\${ex.tipo}</td>' "$app_file"; then fail "Examen sin escapar"; fi
if grep -q 'Restricciones: \${evento.detalle.restricciones}' "$app_file"; then fail "Restricción sin escapar"; fi
echo "✅ PASS: interpolaciones conocidas están escapadas"
