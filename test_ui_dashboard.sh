#!/usr/bin/env bash
set -euo pipefail

rg -q 'id="dashTotalActas"' index.html
rg -q 'id="dashRiesgosCriticos"' index.html
rg -q 'id="dashIncidentesActivos"' index.html
rg -q 'id="dashDiasSinAccidentes"' index.html
rg -q 'id="dashboardAlertas"' index.html
rg -q 'id="dashboardEvolucion"' index.html
rg -q 'function renderizarDashboard' app.js
rg -q "i.tipo === 'Accidente'" app.js
rg -q 'fechaRiesgoVencida' app.js
rg -q "c.estado === 'Programada'" app.js
if rg -q '<div class="value">(24|156|187)</div>' index.html; then
  echo 'ERROR: el dashboard conserva indicadores simulados' >&2
  exit 1
fi

echo 'OK: dashboard consolidado sin indicadores simulados.'
