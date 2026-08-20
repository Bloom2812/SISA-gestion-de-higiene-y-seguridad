#!/bin/bash
set -eu

rules_file="${1:-firestore.rules}"

fail() {
  echo "❌ FAIL: $1"
  exit 1
}

grep -q "Médico Ocupacional" "$rules_file" || fail "Falta el rol Médico Ocupacional"
grep -q "isOccupationalHealthStaff" "$rules_file" || fail "Falta el control de Salud Ocupacional"
grep -q "match /trabajadores/{trabajadorId}" "$rules_file" || fail "Faltan reglas para trabajadores"
grep -q "match /examenes_medicos/{examenId}" "$rules_file" || fail "Faltan reglas para exámenes"
grep -q "match /{document=\*\*}" "$rules_file" || fail "Falta cierre por defecto"

if grep -q "request.time < timestamp.date" "$rules_file"; then
  fail "Permanece una regla temporal por fecha"
fi

if grep -q "match /{collectionName}/{document=\*\*}" "$rules_file"; then
  fail "Permanece la regla transitoria abierta"
fi

echo "✅ PASS: línea base estática de seguridad presente"
