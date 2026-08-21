#!/usr/bin/env bash
set -euo pipefail

rg -q 'id="actaStatTotal"' index.html
rg -q 'id="actasTableBody"' index.html
rg -q 'id="actaBuscar"' index.html
rg -q 'id="actaCompromiso"' index.html
rg -q 'id="modalDetalleActa"' index.html
rg -q "const coleccionActas = collection" app.js
rg -q 'function iniciarSuscripcionActas' app.js
rg -q 'function abrirDetalleActa' app.js
rg -q "estado: 'Borrador'" app.js
rg -Fq 'match /actas/{actaId}' firestore.rules
rg -q 'allow delete: if false' firestore.rules

echo 'OK: interfaz y persistencia base de Actas verificadas.'
