#!/bin/bash
echo "TEST 1: Verifica que no haya deleteDoc para trabajadores"
if grep -q "deleteDoc(.*'trabajadores'" app.js; then
  echo "❌ FAIL: deleteDoc encontrado en app.js para trabajadores"
else
  echo "✅ PASS: No hay deleteDoc para trabajadores en app.js"
fi

echo "TEST 2: Verifica que existe modalArchivarTrabajador en index.html"
if grep -q "id=\"modalArchivarTrabajador\"" index.html; then
  echo "✅ PASS: modalArchivarTrabajador encontrado en index.html"
else
  echo "❌ FAIL: modalArchivarTrabajador no encontrado"
fi

echo "TEST 3: Verifica boton archivar en app.js"
if grep -q "btn-archivar-trabajador" app.js; then
  echo "✅ PASS: boton archivar encontrado"
else
  echo "❌ FAIL: boton archivar no encontrado"
fi

echo "TEST 4: Verifica boton restaurar en app.js"
if grep -q "btn-restaurar-trabajador" app.js; then
  echo "✅ PASS: boton restaurar encontrado"
else
  echo "❌ FAIL: boton restaurar no encontrado"
fi

echo "TEST 5: Verifica filtro dinámico de expedientes"
if grep -q 'id="filterTipo"' index.html \
  && grep -q '<option value="archivo">Expedientes</option>' index.html \
  && grep -q "archivo:" app.js; then
  echo "✅ PASS: filtro dinámico de expedientes encontrado"
else
  echo "❌ FAIL: filtro dinámico de expedientes no encontrado"
fi
