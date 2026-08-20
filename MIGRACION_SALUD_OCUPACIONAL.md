# Cierre de migración de Salud Ocupacional

## Estado

La migración desde los campos legacy de `trabajadores` finalizó y fue
verificada funcionalmente el 20 de agosto de 2026.

Los datos se almacenan en las colecciones separadas:

- `salud_clinica/{trabajadorId}` para información clínica, accesible únicamente
  por el rol `Médico Ocupacional`.
- `aptitudes_ocupacionales/{trabajadorId}` para aptitud laboral, legible por el
  personal autorizado de Salud Ocupacional y editable únicamente por el rol
  `Médico Ocupacional`.

## Resultado verificado

- Tres trabajadores analizados.
- Cero expedientes con campos legacy.
- Cero expedientes bloqueados.
- Cero errores de auditoría.
- Perfiles comprobados con los roles `Médico Ocupacional` y `Responsable H&S`.

## Cierre operativo

Las utilidades temporales de migración, reparación, auditoría y limpieza fueron
retiradas de la aplicación. No deben reintroducirse ni ejecutarse operaciones
manuales sobre Firestore sin una nueva revisión, pruebas y autorización.