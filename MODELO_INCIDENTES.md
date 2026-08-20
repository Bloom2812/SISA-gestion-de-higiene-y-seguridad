# Modelo inicial del módulo Incidentes

## Alcance de esta etapa

Esta primera etapa define la estructura operacional, las reglas de acceso y la
trazabilidad del expediente. Todavía no incorpora formularios, filtros,
investigación causal, acciones correctivas, archivos adjuntos ni indicadores.

## Colección principal

Ruta:

```text
artifacts/{appId}/public/data/incidentes/{incidenteId}
```

Campos admitidos:

| Campo | Tipo | Obligatorio | Criterio |
| --- | --- | --- | --- |
| `codigo` | string | Sí | Identificador visible e inmutable |
| `tipo` | string | Sí | Incidente, Accidente o Cuasi accidente |
| `fecha_evento` | timestamp | Sí | Fecha y hora del evento |
| `area_id` | string | Sí | Referencia al área registrada |
| `area_nombre` | string | Sí | Copia operacional del nombre del área |
| `lugar_especifico` | string | No | Ubicación dentro del área |
| `trabajador_id` | string/null | No | Referencia al trabajador afectado |
| `descripcion` | string | Sí | Hechos observables, entre 10 y 2000 caracteres |
| `acciones_inmediatas` | string | No | Contención ejecutada al detectar el evento |
| `gravedad` | string | Sí | Baja, Media, Alta o Crítica |
| `estado` | string | Sí | Reportado, En investigación, Acciones en curso o Cerrado |
| `reportado_por` | string | Sí | UID del creador; inmutable |
| `fecha_creacion` | timestamp | Sí | Marca del servidor; inmutable |
| `ultima_actualizacion` | timestamp | Sí | Marca del servidor en cada escritura |

No se admiten diagnósticos, tratamientos, restricciones médicas ni otros datos
clínicos en esta colección. Cualquier seguimiento médico deberá almacenarse en
una estructura separada y protegida por el rol Médico Ocupacional.

## Bitácora

Ruta:

```text
artifacts/{appId}/public/data/incidentes/{incidenteId}/historial/{eventoId}
```

La bitácora permite crear eventos, pero prohíbe modificarlos y eliminarlos. Cada
entrada registra tipo, descripción, UID del usuario y fecha del servidor.

Las reglas comprueban que las referencias a área y trabajador existan. Un
expediente nuevo debe iniciar en `Reportado`; los cambios de estado siguen una
secuencia controlada y un expediente `Cerrado` queda bloqueado contra nuevas
modificaciones.

## Permisos conservados en esta etapa

| Operación | Permiso |
| --- | --- |
| Consultar expediente operacional | Cualquier usuario con perfil válido |
| Crear o actualizar | Administrador y Responsable H&S |
| Eliminar | Ningún rol |
| Crear evento de bitácora | Administrador y Responsable H&S |
| Modificar o eliminar bitácora | Ningún rol |

La futura creación por Trabajador o Supervisor requiere primero una relación
verificable entre usuario, trabajador y área. No debe autorizarse únicamente
desde la interfaz porque Firestore debe poder comprobar esa relación.
