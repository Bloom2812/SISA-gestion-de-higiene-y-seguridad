# Pruebas de reglas de Firestore

Requisitos: Node.js 20 o superior y Java para Firebase Emulator.

```bash
npm install
npm run test:rules
```

La ejecución usa el proyecto local `demo-sisa`; no escribe en producción.
Verifica autenticación, permisos por rol, aislamiento clínico, historial
append-only y cierre de colecciones no declaradas.
