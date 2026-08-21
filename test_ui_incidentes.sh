#!/usr/bin/env bash
set -euo pipefail

fail() { echo "ERROR: $1" >&2; exit 1; }

grep -q 'id="page-incidentes"' index.html || fail "Falta la página de Incidentes"
grep -q 'id="formIncidente"' index.html || fail "Falta el formulario de reporte"
grep -q 'id="incFiltroCampo"' index.html || fail "Falta el filtro dinámico"
grep -q 'iniciarSuscripcionIncidentes' app.js || fail "Falta la lectura en tiempo real"
grep -q "collection(incidenteRef, 'historial')" app.js || fail "Falta la bitácora anidada"
grep -q "estado: 'Reportado'" app.js || fail "Los reportes no inician en estado Reportado"
grep -q 'batch.set(incidenteRef, datos)' app.js || fail "El incidente no se guarda de forma atómica"
grep -q 'batch.set(historialRef' app.js || fail "La bitácora no se guarda de forma atómica"
grep -q 'escapeHtml(i.descripcion)' app.js || fail "La descripción no se escapa al renderizar"
grep -q 'id="formInvestigacionIncidente"' index.html || fail "Falta el formulario de investigación causal"
grep -q "metodologia: '5 Porqués'" app.js || fail "Falta la metodología causal controlada"
grep -q "batch.update(incidenteRef, { estado: 'En investigación'" app.js || fail "El inicio de investigación no actualiza el estado atómicamente"
grep -q "tipo_evento: 'INICIO_INVESTIGACION'" app.js || fail "Falta la trazabilidad del inicio de investigación"
grep -q 'escapeHtml(inv.causa_raiz)' app.js || fail "La causa raíz no se escapa al renderizar"

incident_section="$(sed -n '/MÓDULO DE INCIDENTES/,/INTERFAZ DE USUARIO/p' app.js)"
if grep -q 'deleteDoc' <<<"$incident_section"; then
  fail "El módulo de Incidentes no debe eliminar documentos"
fi

echo "OK: interfaz inicial de Incidentes segura y trazable"
