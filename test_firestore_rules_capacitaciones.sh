#!/usr/bin/env bash
set -euo pipefail

fail() { echo "❌ FAIL: $1" >&2; exit 1; }

grep -q "function isTrainingManager" firestore.rules || fail "Falta el gestor autorizado"
grep -q "function isValidTraining(appId, data)" firestore.rules || fail "Falta la validación estructural"
grep -q "function isValidTrainingTransition" firestore.rules || fail "Falta la transición de estados"
grep -q "function trainingAreaReferenceIsValid" firestore.rules || fail "Falta validar el área"
grep -q "match /capacitaciones/{capacitacionId}" firestore.rules || fail "Faltan reglas de Capacitaciones"
grep -q "request.resource.data.estado == 'Programada'" firestore.rules || fail "La creación no restringe el estado"
grep -q "request.resource.data.creado_por == request.auth.uid" firestore.rules || fail "La creación no valida autoría"
grep -q "request.resource.data.fecha_creacion == request.time" firestore.rules || fail "La creación no exige hora del servidor"
grep -q "allow delete: if false" firestore.rules || fail "La eliminación debe permanecer bloqueada"

echo "OK: reglas seguras de Capacitaciones presentes"
