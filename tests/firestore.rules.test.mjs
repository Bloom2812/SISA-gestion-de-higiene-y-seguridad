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
