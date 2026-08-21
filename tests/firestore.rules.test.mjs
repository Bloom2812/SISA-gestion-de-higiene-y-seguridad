import test, { after, beforeEach } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'demo-sisa';
const APP_ID = 'sisa-mi-empresa';
const base = `artifacts/${APP_ID}/public/data`;
let env;

const ruta = (coleccion, id) => `${base}/${coleccion}/${id}`;
const dbDe = uid => env.authenticatedContext(uid).firestore();

async function crearPerfil(uid, rol) {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), ruta('usuarios', uid)), {
      nombre: uid, correo: `${uid}@example.invalid`, rol
    });
  });
}

async function sembrarDatos() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, ruta('trabajadores', 'trabajador-1')), {
      nombres: 'Persona', apellidos: 'Prueba', estado_laboral: 'Activo'
    });
    await setDoc(doc(db, ruta('areas', 'mantenimiento')), {
      nombre: 'Mantenimiento'
    });
    await setDoc(doc(db, ruta('areas', 'produccion')), {
      nombre: 'Producción'
    });
    await setDoc(doc(db, ruta('salud_clinica', 'trabajador-1')), {
      trabajador_id: 'trabajador-1', alergias: ['Prueba']
    });
    await setDoc(doc(db, ruta('aptitudes_ocupacionales', 'trabajador-1')), {
      trabajador_id: 'trabajador-1', aptitud_ocupacional: 'Apto'
    });
    await setDoc(doc(db, ruta('incidentes', 'incidente-semilla')), {
      codigo: 'INC-2026-0001',
      tipo: 'Incidente',
      fecha_evento: Timestamp.fromDate(new Date('2026-08-20T14:00:00Z')),
      area_id: 'mantenimiento',
      area_nombre: 'Mantenimiento',
      descripcion: 'Contacto menor con una guarda sin lesión reportada.',
      gravedad: 'Baja',
      estado: 'Reportado',
      reportado_por: 'hs',
      fecha_creacion: Timestamp.fromDate(new Date('2026-08-20T14:10:00Z')),
      ultima_actualizacion: Timestamp.fromDate(new Date('2026-08-20T14:10:00Z'))
    });
  });
}

function incidenteValido(uid, codigo = 'INC-2026-0002') {
  return {
    codigo,
    tipo: 'Cuasi accidente',
    fecha_evento: Timestamp.fromDate(new Date('2026-08-20T15:00:00Z')),
    area_id: 'produccion',
    area_nombre: 'Producción',
    lugar_especifico: 'Pasillo de acceso',
    trabajador_id: 'trabajador-1',
    descripcion: 'Objeto detectado en zona de paso antes de provocar una caída.',
    acciones_inmediatas: 'Se retiró el objeto y se delimitó temporalmente el área.',
    gravedad: 'Media',
    estado: 'Reportado',
    reportado_por: uid,
    fecha_creacion: serverTimestamp(),
    ultima_actualizacion: serverTimestamp()
  };
}

function capacitacionValida(uid, codigo = 'CAP-2026-0001') {
  return {
    codigo,
    titulo: 'Buenas prácticas de manufactura',
    categoria: 'BPM',
    modalidad: 'Presencial',
    fecha_inicio: Timestamp.fromDate(new Date('2026-09-15T14:00:00Z')),
    duracion_minutos: 120,
    instructor: 'Especialista QA',
    alcance: 'Toda la organización',
    lugar: 'Sala de capacitación',
    objetivo: 'Fortalecer la aplicación uniforme de las buenas prácticas de manufactura.',
    estado: 'Programada',
    creado_por: uid,
    fecha_creacion: serverTimestamp(),
    ultima_actualizacion: serverTimestamp()
  };
}

function riesgo5x5Valido(uid, codigo = 'RSK-2026-0001', metodologia = 'Matriz 5x5') {
  const data = {
    codigo, metodologia, area_id: 'mantenimiento', area_nombre: 'Mantenimiento',
    actividad: 'Manipulación de materiales', peligro: 'Caída de objetos durante el traslado',
    consecuencia: 'Golpes o lesiones al personal expuesto', controles_existentes: 'Área delimitada',
    probabilidad: 3, severidad: 4, nivel_riesgo: 12, prioridad: 'Alta',
    responsable: 'Jefatura de mantenimiento', estado: 'Identificado', creado_por: uid,
    fecha_creacion: serverTimestamp(), ultima_actualizacion: serverTimestamp()
  };
  if (metodologia === 'JSA 5x5') data.paso_tarea = 'Elevar la carga al segundo nivel';
  return data;
}

function riesgoNtp330Valido(uid, codigo = 'RSK-2026-NTP1') {
  return {
    codigo, metodologia: 'NTP 330', area_id: 'mantenimiento', area_nombre: 'Mantenimiento',
    actividad: 'Inspección de tablero eléctrico', peligro: 'Contacto con partes energizadas',
    consecuencia: 'Electrocución o quemaduras graves', controles_existentes: 'Señalización existente',
    nivel_deficiencia: 6, nivel_exposicion: 2, nivel_consecuencia: 60,
    nivel_riesgo: 720, prioridad: 'Crítica', responsable: 'Jefatura de mantenimiento',
    estado: 'Identificado', creado_por: uid,
    fecha_creacion: serverTimestamp(), ultima_actualizacion: serverTimestamp()
  };
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await Promise.all([
    crearPerfil('admin', 'Administrador'),
    crearPerfil('medico', 'Médico Ocupacional'),
    crearPerfil('hs', 'Responsable H&S'),
    crearPerfil('gerencia', 'Gerencia'),
    crearPerfil('supervisor', 'Supervisor'),
    crearPerfil('trabajador', 'Trabajador')
  ]);
  await sembrarDatos();
});

after(async () => { await env.cleanup(); });

test('usuario no autenticado no puede leer trabajadores', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, ruta('trabajadores', 'trabajador-1'))));
});

test('médico puede leer y actualizar salud clínica', async () => {
  const ref = doc(dbDe('medico'), ruta('salud_clinica', 'trabajador-1'));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(updateDoc(ref, { tipo_sangre: 'O+' }));
});

test('Responsable H&S no puede leer ni escribir salud clínica', async () => {
  const ref = doc(dbDe('hs'), ruta('salud_clinica', 'trabajador-1'));
  await assertFails(getDoc(ref));
  await assertFails(updateDoc(ref, { tipo_sangre: 'A+' }));
});

test('Responsable H&S consulta aptitud pero no la modifica', async () => {
  const ref = doc(dbDe('hs'), ruta('aptitudes_ocupacionales', 'trabajador-1'));
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref, { aptitud_ocupacional: 'No apto temporalmente' }));
});

test('médico puede modificar aptitud ocupacional', async () => {
  const ref = doc(dbDe('medico'), ruta('aptitudes_ocupacionales', 'trabajador-1'));
  await assertSucceeds(updateDoc(ref, {
    aptitud_ocupacional: 'Apto con restricciones',
    aptitud_restricciones: 'No levantar cargas'
  }));
});

test('Responsable H&S puede registrar control de examen', async () => {
  await assertSucceeds(setDoc(doc(dbDe('hs'), ruta('examenes_medicos', 'examen-1')), {
    trabajador_id: 'trabajador-1', tipo: 'Auditivo',
    realizacion: '2026-08-20', vencimiento: '2027-08-20'
  }));
});

test('administrador gestiona usuarios pero no lee datos clínicos', async () => {
  const db = dbDe('admin');
  await assertSucceeds(setDoc(doc(db, ruta('usuarios', 'nuevo-usuario')), {
    nombre: 'Nuevo', correo: 'nuevo@example.invalid', rol: 'Supervisor'
  }));
  await assertFails(getDoc(doc(db, ruta('salud_clinica', 'trabajador-1'))));
});

for (const [uid, rol] of [
  ['gerencia', 'Gerencia'], ['supervisor', 'Supervisor'], ['trabajador', 'Trabajador']
]) {
  test(`${rol} no puede leer información médica`, async () => {
    const db = dbDe(uid);
    await assertFails(getDoc(doc(db, ruta('salud_clinica', 'trabajador-1'))));
    await assertFails(getDoc(doc(db, ruta('aptitudes_ocupacionales', 'trabajador-1'))));
  });
}

test('historial permite crear, pero impide modificar y eliminar', async () => {
  const ref = doc(dbDe('medico'), `${ruta('trabajadores', 'trabajador-1')}/historial_ocupacional/evento-1`);
  await assertSucceeds(setDoc(ref, { tipo_evento: 'APTITUD_OCUPACIONAL', titulo: 'Prueba' }));
  await assertFails(updateDoc(ref, { titulo: 'Alterado' }));
  await assertFails(deleteDoc(ref));
});

test('usuarios con perfil pueden consultar incidentes operacionales', async () => {
  for (const uid of ['admin', 'medico', 'hs', 'gerencia', 'supervisor', 'trabajador']) {
    await assertSucceeds(getDoc(doc(dbDe(uid), ruta('incidentes', 'incidente-semilla'))));
  }
});

test('usuario no autenticado no puede consultar incidentes', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, ruta('incidentes', 'incidente-semilla'))));
});

test('Administrador y Responsable H&S pueden registrar un incidente válido', async () => {
  await assertSucceeds(setDoc(
    doc(dbDe('admin'), ruta('incidentes', 'incidente-admin')),
    incidenteValido('admin', 'INC-2026-0002')
  ));
  await assertSucceeds(setDoc(
    doc(dbDe('hs'), ruta('incidentes', 'incidente-hs')),
    incidenteValido('hs', 'INC-2026-0003')
  ));
});

for (const [uid, rol] of [
  ['medico', 'Médico Ocupacional'],
  ['gerencia', 'Gerencia'],
  ['supervisor', 'Supervisor'],
  ['trabajador', 'Trabajador']
]) {
  test(`${rol} no puede crear ni modificar incidentes`, async () => {
    await assertFails(setDoc(
      doc(dbDe(uid), ruta('incidentes', `incidente-${uid}`)),
      incidenteValido(uid, `INC-2026-${uid}`)
    ));
    await assertFails(updateDoc(
      doc(dbDe(uid), ruta('incidentes', 'incidente-semilla')),
      { estado: 'En investigación', ultima_actualizacion: serverTimestamp() }
    ));
  });
}

test('un incidente rechaza tipos, estados y campos no autorizados', async () => {
  await assertFails(setDoc(
    doc(dbDe('hs'), ruta('incidentes', 'incidente-tipo-invalido')),
    { ...incidenteValido('hs', 'INC-2026-0004'), tipo: 'Lesión clínica' }
  ));
  await assertFails(setDoc(
    doc(dbDe('hs'), ruta('incidentes', 'incidente-estado-invalido')),
    { ...incidenteValido('hs', 'INC-2026-0005'), estado: 'Eliminado' }
  ));
  await assertFails(setDoc(
    doc(dbDe('hs'), ruta('incidentes', 'incidente-dato-clinico')),
    { ...incidenteValido('hs', 'INC-2026-0006'), diagnostico_medico: 'Dato no permitido' }
  ));
});

test('un incidente rechaza referencias inexistentes y fechas futuras', async () => {
  await assertFails(setDoc(
    doc(dbDe('hs'), ruta('incidentes', 'incidente-area-invalida')),
    { ...incidenteValido('hs', 'INC-2026-0007'), area_id: 'area-inexistente' }
  ));
  await assertFails(setDoc(
    doc(dbDe('hs'), ruta('incidentes', 'incidente-trabajador-invalido')),
    { ...incidenteValido('hs', 'INC-2026-0008'), trabajador_id: 'trabajador-inexistente' }
  ));
  await assertFails(setDoc(
    doc(dbDe('hs'), ruta('incidentes', 'incidente-fecha-futura')),
    {
      ...incidenteValido('hs', 'INC-2026-0009'),
      fecha_evento: Timestamp.fromDate(new Date('2099-01-01T00:00:00Z'))
    }
  ));
});

test('un expediente nuevo debe iniciar en estado Reportado', async () => {
  await assertFails(setDoc(
    doc(dbDe('hs'), ruta('incidentes', 'incidente-estado-inicial')),
    { ...incidenteValido('hs', 'INC-2026-0010'), estado: 'Cerrado' }
  ));
});

test('el código, autor y fecha de creación del incidente son inmutables', async () => {
  const ref = doc(dbDe('hs'), ruta('incidentes', 'incidente-semilla'));
  await assertFails(updateDoc(ref, {
    codigo: 'INC-ALTERADO',
    ultima_actualizacion: serverTimestamp()
  }));
  await assertFails(updateDoc(ref, {
    reportado_por: 'admin',
    ultima_actualizacion: serverTimestamp()
  }));
  await assertFails(updateDoc(ref, {
    fecha_creacion: serverTimestamp(),
    ultima_actualizacion: serverTimestamp()
  }));
});

test('Responsable H&S actualiza el estado sin alterar identidad ni creación', async () => {
  await assertFails(updateDoc(
    doc(dbDe('hs'), ruta('incidentes', 'incidente-semilla')),
    { estado: 'En investigación', ultima_actualizacion: serverTimestamp() }
  ));
});

function investigacionValida(uid) {
  return {
    metodologia: '5 Porqués',
    hechos_confirmados: 'Se confirmó un objeto en la zona demarcada de tránsito.',
    causa_inmediata: 'Objeto colocado en el pasillo.',
    por_que_1: 'El objeto quedó fuera de su ubicación definida.',
    por_que_2: 'La ubicación temporal no estaba señalizada.',
    por_que_3: 'El proceso no define una zona temporal de almacenamiento.',
    por_que_4: 'El estándar de orden no contempla materiales en tránsito.',
    por_que_5: 'La evaluación del flujo de materiales estaba incompleta.',
    causa_raiz: 'Falta de un estándar para materiales en tránsito.',
    factores_contribuyentes: 'Demarcación insuficiente y supervisión no documentada.',
    investigador_id: uid,
    fecha_inicio: serverTimestamp(),
    ultima_actualizacion: serverTimestamp()
  };
}

function investigacionActualValida(uid, metodologia = '5 Porqués') {
  const usaSeisCampos = metodologia !== '5 Porqués';
  return {
    metodologia,
    hechos_confirmados: 'Se confirmó una condición ficticia durante una prueba controlada.',
    causa_inmediata: 'Control preventivo insuficiente durante la prueba.',
    analisis_metodo: {
      respuesta_1: 'Respuesta verificable número uno.',
      respuesta_2: 'Respuesta verificable número dos.',
      respuesta_3: 'Respuesta verificable número tres.',
      respuesta_4: 'Respuesta verificable número cuatro.',
      respuesta_5: 'Respuesta verificable número cinco.',
      respuesta_6: usaSeisCampos ? 'Respuesta verificable número seis.' : ''
    },
    causa_raiz: 'Control sistémico insuficientemente definido.',
    factores_contribuyentes: 'Condiciones adicionales documentadas para la prueba.',
    investigador_id: uid,
    fecha_inicio: serverTimestamp(),
    ultima_actualizacion: serverTimestamp()
  };
}

test('iniciar investigación exige cambio de estado, documento causal y bitácora atómicos', async () => {
  const db = dbDe('hs');
  const incidenteRef = doc(db, ruta('incidentes', 'incidente-semilla'));
  const investigacionRef = doc(db, `${ruta('incidentes', 'incidente-semilla')}/investigacion/principal`);
  const historialRef = doc(db, `${ruta('incidentes', 'incidente-semilla')}/historial/inicio-investigacion`);
  const batch = writeBatch(db);
  batch.update(incidenteRef, { estado: 'En investigación', ultima_actualizacion: serverTimestamp() });
  batch.set(investigacionRef, investigacionValida('hs'));
  batch.set(historialRef, {
    tipo_evento: 'INICIO_INVESTIGACION',
    descripcion: 'Investigación causal iniciada con metodología 5 Porqués.',
    usuario_id: 'hs',
    fecha: serverTimestamp()
  });
  await assertSucceeds(batch.commit());
});

test('investigación causal rechaza roles no autorizados, campos incompletos y eliminación', async () => {
  const rutaInvestigacion = `${ruta('incidentes', 'incidente-semilla')}/investigacion/principal`;
  await assertFails(setDoc(doc(dbDe('supervisor'), rutaInvestigacion), investigacionValida('supervisor')));
  await assertFails(setDoc(doc(dbDe('hs'), rutaInvestigacion), {
    ...investigacionValida('hs'),
    por_que_5: ''
  }));
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), rutaInvestigacion), {
      ...investigacionValida('hs'),
      fecha_inicio: Timestamp.now(),
      ultima_actualizacion: Timestamp.now()
    });
  });
  await assertFails(deleteDoc(doc(dbDe('hs'), rutaInvestigacion)));
});

test('acepta los tres métodos vigentes y conserva compatibilidad con 5 Porqués legacy', async () => {
  for (const [indice, metodologia] of ['5 Porqués', 'Ishikawa 6M', 'Análisis de barreras'].entries()) {
    const id = `incidente-metodo-${indice}`;
    const rutaIncidente = ruta('incidentes', id);
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), rutaIncidente), incidenteValido('hs'));
    });
    const db = dbDe('hs');
    const incidenteRef = doc(db, rutaIncidente);
    const batch = writeBatch(db);
    batch.update(incidenteRef, { estado: 'En investigación', ultima_actualizacion: serverTimestamp() });
    batch.set(doc(db, `${rutaIncidente}/investigacion/principal`), investigacionActualValida('hs', metodologia));
    batch.set(doc(db, `${rutaIncidente}/historial/inicio-${indice}`), {
      tipo_evento: 'INICIO_INVESTIGACION',
      descripcion: `Investigación causal iniciada con metodología ${metodologia}.`,
      usuario_id: 'hs',
      fecha: serverTimestamp()
    });
    await assertSucceeds(batch.commit());
  }
});

test('rechaza métodos no autorizados y análisis 6M incompletos', async () => {
  const rutaInvestigacion = `${ruta('incidentes', 'incidente-semilla')}/investigacion/principal`;
  await assertFails(setDoc(doc(dbDe('hs'), rutaInvestigacion), {
    ...investigacionActualValida('hs'),
    metodologia: 'Método libre'
  }));
  await assertFails(setDoc(doc(dbDe('hs'), rutaInvestigacion), {
    ...investigacionActualValida('hs', 'Ishikawa 6M'),
    analisis_metodo: {
      ...investigacionActualValida('hs', 'Ishikawa 6M').analisis_metodo,
      respuesta_6: ''
    }
  }));
});

test('el flujo impide saltos de estado y bloquea expedientes cerrados', async () => {
  const ref = doc(dbDe('hs'), ruta('incidentes', 'incidente-semilla'));
  await assertFails(updateDoc(ref, {
    estado: 'Cerrado',
    ultima_actualizacion: serverTimestamp()
  }));

  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), ruta('incidentes', 'incidente-semilla')), {
      estado: 'Cerrado'
    });
  });

  await assertFails(updateDoc(ref, {
    descripcion: 'Intento de alterar un expediente que ya fue cerrado.',
    ultima_actualizacion: serverTimestamp()
  }));
});

test('ningún rol puede eliminar un incidente', async () => {
  for (const uid of ['admin', 'hs', 'gerencia', 'supervisor', 'trabajador']) {
    await assertFails(deleteDoc(doc(dbDe(uid), ruta('incidentes', 'incidente-semilla'))));
  }
});

test('gestores registran riesgos con Matriz 5x5, JSA y NTP 330', async () => {
  await assertSucceeds(setDoc(doc(dbDe('admin'), ruta('riesgos', 'matriz')), riesgo5x5Valido('admin')));
  await assertSucceeds(setDoc(doc(dbDe('hs'), ruta('riesgos', 'jsa')), riesgo5x5Valido('hs', 'RSK-2026-JSA1', 'JSA 5x5')));
  await assertSucceeds(setDoc(doc(dbDe('hs'), ruta('riesgos', 'ntp')), riesgoNtp330Valido('hs')));
});

test('rechaza escalas, cálculos y prioridades de riesgo inconsistentes', async () => {
  await assertFails(setDoc(doc(dbDe('hs'), ruta('riesgos', 'escala-invalida')), {
    ...riesgo5x5Valido('hs'), probabilidad: 10, nivel_riesgo: 40, prioridad: 'Crítica'
  }));
  await assertFails(setDoc(doc(dbDe('hs'), ruta('riesgos', 'calculo-invalido')), {
    ...riesgoNtp330Valido('hs'), nivel_riesgo: 12, prioridad: 'Baja'
  }));
  await assertFails(setDoc(doc(dbDe('hs'), ruta('riesgos', 'jsa-incompleto')), {
    ...riesgo5x5Valido('hs', 'RSK-2026-JSA2'), metodologia: 'JSA 5x5'
  }));
});

test('riesgos respetan roles, transiciones, identidad y conservación', async () => {
  for (const uid of ['medico', 'gerencia', 'supervisor', 'trabajador']) {
    await assertFails(setDoc(doc(dbDe(uid), ruta('riesgos', `riesgo-${uid}`)), riesgo5x5Valido(uid, `RSK-2026-${uid.toUpperCase()}`)));
  }
  const ref = doc(dbDe('hs'), ruta('riesgos', 'flujo-riesgo'));
  await assertSucceeds(setDoc(ref, riesgo5x5Valido('hs', 'RSK-2026-FLUJO')));
  await assertSucceeds(updateDoc(ref, { estado: 'En tratamiento', ultima_actualizacion: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { estado: 'Controlado', ultima_actualizacion: serverTimestamp() }));
  await assertFails(updateDoc(ref, { metodologia: 'NTP 330', ultima_actualizacion: serverTimestamp() }));
  await assertFails(updateDoc(ref, { estado: 'Identificado', ultima_actualizacion: serverTimestamp() }));
  await assertFails(deleteDoc(ref));
});

test('usuarios con perfil pueden consultar capacitaciones, pero una sesión anónima no', async () => {
  await assertSucceeds(getDoc(doc(dbDe('trabajador'), ruta('capacitaciones', 'capacitacion-semilla'))));
  const dbAnonima = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(dbAnonima, ruta('capacitaciones', 'capacitacion-semilla'))));
});

test('Administrador y Responsable H&S pueden programar capacitaciones de categorías abiertas', async () => {
  for (const uid of ['admin', 'hs']) {
    const ref = doc(dbDe(uid), ruta('capacitaciones', `capacitacion-${uid}`));
    const datos = capacitacionValida(uid, `CAP-2026-${uid.toUpperCase()}`);
    datos.categoria = uid == 'admin' ? 'Higiene y seguridad' : 'BPM';
    await assertSucceeds(setDoc(ref, datos));
  }
});

test('otros roles no pueden programar ni modificar capacitaciones', async () => {
  for (const uid of ['medico', 'gerencia', 'supervisor', 'trabajador']) {
    const ref = doc(dbDe(uid), ruta('capacitaciones', `capacitacion-${uid}`));
    await assertFails(setDoc(ref, capacitacionValida(uid, `CAP-2026-${uid.toUpperCase()}`)));
  }
});

test('el alcance de una capacitación exige una referencia de área coherente', async () => {
  const db = dbDe('hs');
  const organizacional = capacitacionValida('hs', 'CAP-2026-ORG');
  organizacional.area_id = 'mantenimiento';
  organizacional.area_nombre = 'Mantenimiento';
  await assertFails(setDoc(doc(db, ruta('capacitaciones', 'alcance-inconsistente')), organizacional));

  const inexistente = capacitacionValida('hs', 'CAP-2026-AREA');
  inexistente.alcance = 'Área específica';
  inexistente.area_id = 'area-inexistente';
  inexistente.area_nombre = 'Área inexistente';
  await assertFails(setDoc(doc(db, ruta('capacitaciones', 'area-inexistente')), inexistente));

  const valida = capacitacionValida('hs', 'CAP-2026-MANT');
  valida.alcance = 'Área específica';
  valida.area_id = 'mantenimiento';
  valida.area_nombre = 'Mantenimiento';
  await assertSucceeds(setDoc(doc(db, ruta('capacitaciones', 'area-valida')), valida));
});

test('el flujo de capacitación protege identidad, transiciones y eliminación', async () => {
  const ref = doc(dbDe('admin'), ruta('capacitaciones', 'flujo-capacitacion'));
  await assertSucceeds(setDoc(ref, capacitacionValida('admin', 'CAP-2026-FLUJO')));
  await assertFails(updateDoc(ref, { estado: 'Completada', ultima_actualizacion: serverTimestamp() }));
  await assertFails(updateDoc(ref, { codigo: 'CAP-ALTERADA', ultima_actualizacion: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { estado: 'En curso', ultima_actualizacion: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { estado: 'Completada', ultima_actualizacion: serverTimestamp() }));
  await assertFails(updateDoc(ref, { estado: 'Programada', ultima_actualizacion: serverTimestamp() }));
  await assertFails(deleteDoc(ref));
});

test('historial de incidentes es append-only y registra al usuario autenticado', async () => {
  const ref = doc(dbDe('hs'), `${ruta('incidentes', 'incidente-semilla')}/historial/evento-1`);
  await assertSucceeds(setDoc(ref, {
    tipo_evento: 'CAMBIO_ESTADO',
    descripcion: 'El expediente pasó a investigación.',
    usuario_id: 'hs',
    fecha: serverTimestamp()
  }));
  await assertFails(updateDoc(ref, { descripcion: 'Contenido alterado' }));
  await assertFails(deleteDoc(ref));

  await assertFails(setDoc(
    doc(dbDe('hs'), `${ruta('incidentes', 'incidente-semilla')}/historial/evento-2`),
    {
      tipo_evento: 'ACTUALIZACION',
      descripcion: 'Intento con autor diferente.',
      usuario_id: 'admin',
      fecha: serverTimestamp()
    }
  ));
});

test('colección no declarada permanece cerrada', async () => {
  await assertFails(setDoc(doc(dbDe('admin'), ruta('coleccion_no_declarada', 'doc-1')), { valor: true }));
});
