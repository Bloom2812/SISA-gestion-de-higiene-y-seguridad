# Migración controlada de Salud Ocupacional

Utilidad: `scripts/migrar-salud-legacy.js`

## Objetivo

Copiar los campos clínicos y de aptitud que todavía estén dentro de
`trabajadores` hacia:

- `salud_clinica/{trabajadorId}`
- `aptitudes_ocupacionales/{trabajadorId}`

La utilidad no elimina los campos originales. La limpieza se realizará en una
fase posterior, únicamente después de comparar los totales y resolver
conflictos.

## Controles incorporados

- `dryRun: true` por defecto.
- IDs deterministas iguales al ID del trabajador.
- Ejecución por un trabajador específico o por lote.
- Detección de documentos ya migrados.
- Detección de conflictos sin sobrescritura.
- Escritura atómica por trabajador.
- Reporte de candidatos, migrados, conflictos y errores.
- Las reglas exigen el rol `Médico Ocupacional` para escribir datos clínicos
  y aptitudes.

## Secuencia obligatoria

1. Ejecutar primero con `{ dryRun: true }`.
2. Guardar el reporte preliminar.
3. Revisar manualmente todos los conflictos.
4. Ejecutar inicialmente un solo `trabajadorId` con `dryRun: false`.
5. Comparar origen y destino en Firestore.
6. Ejecutar un lote pequeño.
7. Comparar los totales.
8. Ejecutar el resto.
9. No eliminar campos legacy en esta fase.

## Ejemplos

```js
await migrarSaludLegacy(db, { dryRun: true });
await migrarSaludLegacy(db, { dryRun: true, limite: 10 });
await migrarSaludLegacy(db, {
  dryRun: false,
  trabajadorId: 'ID_DEL_TRABAJADOR'
});
```

Este archivo no está conectado automáticamente a la aplicación principal.

## Interfaz controlada

La interfaz permite auditar en `DRY_RUN` y, posteriormente, migrar un solo ID
devuelto por el último reporte. La escritura individual exige confirmar el ID
exacto, vuelve a ejecutar el `DRY_RUN` después de la operación y nunca elimina
los campos legacy.
