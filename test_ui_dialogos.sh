#!/usr/bin/env bash
set -euo pipefail

rg -q 'id="modalConfirmacionAplicacion"' index.html
rg -q 'role="alertdialog"' index.html
rg -q 'function confirmarEnAplicacion' app.js
rg -q "titulo: 'Cerrar sesión'" app.js
rg -q "titulo: 'Eliminar perfil de usuario'" app.js
rg -q "titulo: 'Eliminar área'" app.js
rg -q "titulo: 'Restaurar expediente'" app.js

if rg -n '\b(confirm|alert|prompt)\s*\(' app.js; then
    echo 'Se encontraron diálogos nativos del navegador en app.js' >&2
    exit 1
fi

rg -q '\.app-confirm-overlay' styles.css
rg -q '\.app-confirm-dialog' styles.css
rg -Fq 'styles.css?v=20260821.7' index.html
rg -Fq 'app.js?v=20260821.6' index.html

echo 'OK: diálogos institucionales de SISA verificados'
