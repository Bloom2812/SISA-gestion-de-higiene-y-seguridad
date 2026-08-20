# SISA-gestion-de-higiene-y-seguridad
Aplicacion web para la gestion de higiene y seguridad de la planta corinfar

## Reparación controlada de Salud Ocupacional

La reparación excepcional `repararSaludClinicaFaltante` está limitada al
expediente auditado `aGeKaCkjYNy3jOfyouhh`. Solo crea su destino
`salud_clinica` cuando no existe, conserva los campos legacy, no accede a la
aptitud y verifica equivalencia exacta después de escribir.

La limpieza `limpiarSaludLegacyControlado` está limitada a los dos expedientes
verificados. Antes de eliminar campos vuelve a comparar los once valores con
`salud_clinica` y `aptitudes_ocupacionales`; solo actualiza el documento
`trabajadores` y confirma posteriormente que los destinos sigan existiendo.
