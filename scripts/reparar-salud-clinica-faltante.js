import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const APP_ID = 'sisa-mi-empresa';
export const EXPEDIENTE_REPARABLE = 'aGeKaCkjYNy3jOfyouhh';

const CAMPOS_CLINICOS = [
  'tipo_sangre',
  'alergias',
  'condiciones_medicas',
  'emergencia_contacto_nombre',
  'emergencia_contacto_parentesco',
  'emergencia_contacto_telefono'
];

function tieneCampo(objeto, campo) {
  return Object.prototype.hasOwnProperty.call(objeto || {}, campo);
}

function seleccionarCamposClinicos(origen) {
  return CAMPOS_CLINICOS.reduce((resultado, campo) => {
    if (tieneCampo(origen, campo)) resultado[campo] = origen[campo];
    return resultado;
  }, {});
}

function camposEquivalentes(origen, destino) {
  return CAMPOS_CLINICOS.every(campo =>
    tieneCampo(origen, campo)
    && tieneCampo(destino, campo)
    && JSON.stringify(origen[campo]) === JSON.stringify(destino[campo])
  );
}

/**
 * Repara exclusivamente el destino salud_clinica faltante identificado por la
 * auditoría. No modifica el documento trabajador ni elimina campos legacy.
 */
export async function repararSaludClinicaFaltante(db, trabajadorId) {
  if (!db) throw new Error('Se requiere una instancia válida de Firestore.');
  if (trabajadorId !== EXPEDIENTE_REPARABLE) {
    throw new Error('El expediente no está autorizado para esta reparación.');
  }

  const base = ['artifacts', APP_ID, 'public', 'data'];
  const trabajadorRef = doc(db, ...base, 'trabajadores', trabajadorId);
  const saludRef = doc(db, ...base, 'salud_clinica', trabajadorId);

  await runTransaction(db, async transaction => {
    const [trabajadorSnap, saludSnap] = await Promise.all([
      transaction.get(trabajadorRef),
      transaction.get(saludRef)
    ]);

    if (!trabajadorSnap.exists()) {
      throw new Error('No existe el documento trabajador de origen.');
    }
    if (saludSnap.exists()) {
      throw new Error('El destino salud_clinica ya existe; no se sobrescribió.');
    }

    const trabajador = trabajadorSnap.data();
    const camposFaltantes = CAMPOS_CLINICOS.filter(campo => !tieneCampo(trabajador, campo));
    if (camposFaltantes.length > 0) {
      throw new Error(`Faltan campos legacy requeridos: ${camposFaltantes.join(', ')}`);
    }
    if (trabajador.salud_separada_version !== 1) {
      throw new Error('El marcador de migración no es válido.');
    }

    transaction.set(saludRef, {
      ...seleccionarCamposClinicos(trabajador),
      trabajador_id: trabajadorId,
      origen: 'reparacion_destino_faltante',
      fecha_reparacion: serverTimestamp()
    });
  });

  const [trabajadorVerificacion, saludVerificacion] = await Promise.all([
    getDoc(trabajadorRef),
    getDoc(saludRef)
  ]);

  if (
    !trabajadorVerificacion.exists()
    || !saludVerificacion.exists()
    || !camposEquivalentes(trabajadorVerificacion.data(), saludVerificacion.data())
  ) {
    throw new Error('La verificación posterior no confirmó equivalencia exacta.');
  }

  return {
    modo: 'REPARACION_CONTROLADA_SALUD_CLINICA',
    trabajador_id: trabajadorId,
    destino_creado: 'salud_clinica',
    campos_copiados: [...CAMPOS_CLINICOS],
    aptitud_modificada: false,
    campos_legacy_eliminados: false,
    verificacion_equivalencia: true
  };
}
