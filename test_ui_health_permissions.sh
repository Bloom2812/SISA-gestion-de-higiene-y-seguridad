#!/bin/bash
set -eu
app_file="${1:-app.js}"
html_file="${2:-index.html}"
fail() { echo "❌ FAIL: $1"; exit 1; }
grep -q 'id="navSaludOcupacional"' "$html_file" || fail "Falta identificador del módulo Salud"
grep -q 'id="seccionEdicionAptitud"' "$html_file" || fail "Falta contenedor de edición de aptitud"
grep -q 'id="seccionPerfilClinico"' "$html_file" || fail "Falta contenedor clínico"
grep -q "function aplicarPermisosSalud" "$app_file" || fail "Falta función de permisos"
grep -q "No tiene permisos para acceder a Salud Ocupacional" "$app_file" || fail "Falta bloqueo de navegación"
grep -q "requestedStep === 2 ? 3" "$app_file" || fail "Falta salto del paso clínico para H&S"
grep -q 'id="filterTipo"' "$html_file" || fail "Falta selector de tipo de filtro del directorio"
grep -q 'id="filterValor"' "$html_file" || fail "Falta selector dinámico de valor del directorio"
grep -q "function actualizarOpcionesFiltroValor" "$app_file" || fail "Falta actualización dinámica de opciones"
grep -q "function aplicarFiltroDirectorioSeleccionado" "$app_file" || fail "Falta aplicación del filtro seleccionado"
if grep -Eq 'id="filter(Departamento|EstadoLaboral|EstadoMedico|AptitudOcupacional|Archivo)"' "$html_file"; then
    fail "Persisten filtros independientes retirados del directorio"
fi
echo "✅ PASS: controles estáticos de interfaz por rol presentes"
