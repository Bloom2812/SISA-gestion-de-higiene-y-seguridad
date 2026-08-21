#!/usr/bin/env bash
set -euo pipefail

fail() { echo "❌ FAIL: $1" >&2; exit 1; }

grep -q 'id="page-capacitaciones"' index.html || fail "Falta la página de Capacitaciones"
grep -q 'id="btnNuevaCapacitacion"' index.html || fail "Falta el botón de programación"
grep -q 'id="modalCapacitacion"' index.html || fail "Falta el formulario de programación"
grep -q 'id="capFiltroCampo"' index.html || fail "Falta el filtro dinámico"
grep -q 'id="capacitacionesLista"' index.html || fail "Falta el listado de capacitaciones"
grep -q "const coleccionCapacitaciones" app.js || fail "Falta la colección de Firestore"
grep -q "function iniciarSuscripcionCapacitaciones" app.js || fail "Falta la suscripción en tiempo real"
grep -q "function esGestorCapacitaciones" app.js || fail "Falta el control de permisos de interfaz"
grep -q "estado: 'Programada'" app.js || fail "La creación no fija el estado inicial"
grep -q "fecha_creacion: serverTimestamp()" app.js || fail "Falta la marca temporal del servidor"
grep -q "ultima_actualizacion: serverTimestamp()" app.js || fail "Falta la actualización trazable"

echo "OK: base transversal de Capacitaciones presente"
