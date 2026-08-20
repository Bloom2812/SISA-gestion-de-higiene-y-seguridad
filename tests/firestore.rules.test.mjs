import test, { after, beforeEach } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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
    await setDoc(doc(db, ruta('salud_clinica', 'trabajador-1')), {
      trabajador_id: 'trabajador-1', alergias: ['Prueba']
    });
    await setDoc(doc(db, ruta('aptitudes_ocupacionales', 'trabajador-1')), {
      trabajador_id: 'trabajador-1', aptitud_ocupacional: 'Apto'
    });
  });
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

test('colección no declarada permanece cerrada', async () => {
  await assertFails(setDoc(doc(dbDe('admin'), ruta('coleccion_no_declarada', 'doc-1')), { valor: true }));
});
