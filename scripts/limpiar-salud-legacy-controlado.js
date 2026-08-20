import {
  deleteField,
  doc,
  getDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const APP_ID = 'sisa-mi-empresa';

export const EXPEDIENTES_LIMPIABLES = Object.freeze([
  'UTiuMsznoFC6dkggaGwu',
  'aGeKaCkjYNy3jOfyouhh'
]);

const CAMPOS_CLINICOS = Object.freeze([
  'tipo_sangre',
  'alergias',
  'condiciones_medicas',
  'emergencia_contacto_nombre',
  'emergencia_contacto_parentesco',
  'emergencia_contacto_telefono'
]);

const CAMPOS_APTITUD = Object.freeze([
  'aptitud_ocupacional',
  'aptitud_fecha',
  'aptitud_vigencia',
  'aptitud_restricciones',
  'aptitud_observaciones'
]);

const CAMPOS_LEGACY = Object.freeze([...CAMPOS_CLINICOS, ...CAMPOS_APTITUD]);

function tieneCampo(objeto, campo) {
  return Object.prototype.hasOwnProperty.call(objeto || {}, campo);
}

function camposEquivalentes(origen, destino, campos) {
  return campos.every(campo =>
    tieneCampo(origen, campo)
    && tieneCampo(destino, campo)
    && JSON.stringify(origen[campo]) === JSON.stringify(destino[campo])
  );
}

function seleccionarCampos(origen, campos) {
  return campos.reduce((resultado, campo) => {
    resultado[campo] = origen[campo];
    return resultado;
  }, {});
}

function validarEstado(trabajador, salud, aptitud) {
  if (trabajador.salud_separada_version !== 1) {
    throw new Error('El marcador de migración no es válido.');
  }

  const faltantes = CAMPOS_LEGACY.filter(campo => !tieneCampo(trabajador, campo));
  if (faltantes.length > 0) {
    throw new Error(`El origen no conserva todos los campos legacy: ${faltantes.join(', ')}`);
  }
  if (!salud || !aptitud) {
    throw new Error('Falta al menos un documento separado de destino.');
  }
  if (!camposEquivalentes(trabajador, salud, CAMPOS_CLINICOS)) {
    throw new Error('Los campos clínicos no coinciden con salud_clinica.');
  }
  if (!camposEquivalentes(trabajador, aptitud, CAMPOS_APTITUD)) {
    throw new Error('Los campos de aptitud no coinciden con aptitudes_ocupacionales.');
  }
}

/**
 * Elimina únicamente los once campos legacy del trabajador autorizado.
 * Los documentos separados se leen y verifican, pero nunca se modifican.
 */
export async function limpiarSaludLegacyControlado(db, trabajadorId) {
  if (!db) throw new Error('Se requiere una instancia válida de Firestore.');
  if (!EXPEDIENTES_LIMPIABLES.includes(trabajadorId)) {
    throw new Error('El expediente no está autorizado para limpieza.');
  }

  const base = ['artifacts', APP_ID, 'public', 'data'];
  const trabajadorRef = doc(db, ...base, 'trabajadores', trabajadorId);
  const saludRef = doc(db, ...base, 'salud_clinica', trabajadorId);
  const aptitudRef = doc(db, ...base, 'aptitudes_ocupacionales', trabajadorId);
  let valoresClinicosEsperados = null;
  let valoresAptitudEsperados = null;

  await runTransaction(db, async transaction => {
    const trabajadorSnap = await transaction.get(trabajadorRef);
    const saludSnap = await transaction.get(saludRef);
    const aptitudSnap = await transaction.get(aptitudRef);

    if (!trabajadorSnap.exists()) throw new Error('No existe el trabajador de origen.');
    if (!saludSnap.exists()) throw new Error('No existe el destino salud_clinica.');
    if (!aptitudSnap.exists()) throw new Error('No existe el destino aptitudes_ocupacionales.');

    validarEstado(trabajadorSnap.data(), saludSnap.data(), aptitudSnap.data());
    valoresClinicosEsperados = seleccionarCampos(trabajadorSnap.data(), CAMPOS_CLINICOS);
    valoresAptitudEsperados = seleccionarCampos(trabajadorSnap.data(), CAMPOS_APTITUD);

    const eliminaciones = CAMPOS_LEGACY.reduce((resultado, campo) => {
      resultado[campo] = deleteField();
      return resultado;
    }, {});
    transaction.update(trabajadorRef, eliminaciones);
  });

  const [trabajadorFinal, saludFinal, aptitudFinal] = await Promise.all([
    getDoc(trabajadorRef),
    getDoc(saludRef),
    getDoc(aptitudRef)
  ]);

  if (!trabajadorFinal.exists() || !saludFinal.exists() || !aptitudFinal.exists()) {
    throw new Error('La verificación posterior detectó un documento faltante.');
  }
  const camposPersistentes = CAMPOS_LEGACY.filter(campo =>
    tieneCampo(trabajadorFinal.data(), campo)
  );
  if (camposPersistentes.length > 0) {
    throw new Error(`Persisten campos legacy: ${camposPersistentes.join(', ')}`);
  }
  if (!camposEquivalentes(valoresClinicosEsperados, saludFinal.data(), CAMPOS_CLINICOS)) {
    throw new Error('La verificación posterior detectó cambios en salud_clinica.');
  }
  if (!camposEquivalentes(valoresAptitudEsperados, aptitudFinal.data(), CAMPOS_APTITUD)) {
    throw new Error('La verificación posterior detectó cambios en aptitudes_ocupacionales.');
  }

  return {
    modo: 'LIMPIEZA_LEGACY_CONTROLADA',
    trabajador_id: trabajadorId,
    campos_eliminados: [...CAMPOS_LEGACY],
    documento_trabajador_eliminado: false,
    salud_clinica_conservada: true,
    aptitud_ocupacional_conservada: true,
    verificacion_sin_campos_legacy: true
  };
}
