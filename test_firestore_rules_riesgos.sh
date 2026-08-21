#!/usr/bin/env bash
set -euo pipefail

fail() { echo "❌ FAIL: $1" >&2; exit 1; }

grep -q "function isRiskManager" firestore.rules || fail "Falta el gestor de Riesgos"
grep -q "function isValidRisk(appId, data)" firestore.rules || fail "Falta validación estructural"
grep -q "function isValidFiveByFiveRisk" firestore.rules || fail "Falta validar 5x5/JSA"
grep -q "function isValidNtp330Risk" firestore.rules || fail "Falta validar NTP 330"
grep -q "function isValidRiskTransition" firestore.rules || fail "Falta el flujo de estados"
grep -q "match /riesgos/{riesgoId}" firestore.rules || fail "Faltan reglas de Riesgos"
grep -q "request.resource.data.creado_por == request.auth.uid" firestore.rules || fail "Falta validar autoría"
grep -q "request.resource.data.fecha_creacion == request.time" firestore.rules || fail "Falta hora del servidor"
grep -A18 "match /riesgos/{riesgoId}" firestore.rules | grep -q "allow delete: if false" || fail "La eliminación no está bloqueada"

echo "OK: reglas seguras y multimetodología de Riesgos presentes"
