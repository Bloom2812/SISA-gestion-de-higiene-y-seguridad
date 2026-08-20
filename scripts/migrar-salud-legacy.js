import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const APP_ID = 'sisa-mi-empresa';

const CAMPOS_CLINICOS = [
  'tipo_sangre',
  'alergias',
  'condiciones_medicas',
  'emergencia_contacto_nombre',
  'emergencia_contacto_parentesco',
  'emergencia_contacto_telefono'
];

const CAMPOS_APTITUD = [
  'aptitud_ocupacional',
  'aptitud_fecha',
  'aptitud_vigencia',
  'aptitud_restricciones',
  'aptitud_observaciones'
];

function seleccionarCampos(origen, campos) {
  return campos.reduce((resultado, campo) => {
    if (Object.prototype.hasOwnProperty.call(origen, campo)) {
      resultado[campo] = origen[campo];
    }
    return resultado;
  }, {});
}

function tieneDatos(objeto) {
  return Object.values(objeto).some(valor => {
    if (Array.isArray(valor)) return valor.length > 0;
    return valor !== null && valor !== undefined && valor !== '';
  });
}

function normalizar(objeto) {
  const ordenado = {};
  Object.keys(objeto)
    .sort()
    .forEach(clave => {
      const valor = objeto[clave];
      ordenado[clave] = Array.isArray(valor) ? [...valor].sort() : valor;
    });
  return JSON.stringify(ordenado);
}

function datosEquivalentes(destino, esperado, campos) {
  return normalizar(seleccionarCampos(destino, campos))
    === normalizar(seleccionarCampos(esperado, campos));
}

/**
 * Copia datos médicos heredados a documentos separados.
 *
 * Seguridad:
 * - dryRun es true por defecto.
 * - No elimina campos del documento trabajador.
 * - Los documentos destino usan el mismo ID del trabajador.
 * - Un destino diferente se reporta como conflicto y no se sobrescribe.
 * - Debe ejecutarse con un usuario de rol Médico Ocupacional.
 */
export async function migrarSaludLegacy(db, opciones = {}) {
  const {
    dryRun = true,
    limite = null,
    trabajadorId = null
  } = opciones;

  if (!db) throw new Error('Se requiere una instancia válida de Firestore.');
  if (dryRun !== true && dryRun !== false) {
    throw new Error('dryRun debe ser true o false.');
  }
  if (limite !== null && (!Number.isInteger(limite) || limite < 1)) {
    throw new Error('limite debe ser un entero positivo o null.');
  }

  const base = ['artifacts', APP_ID, 'public', 'data'];
  const trabajadoresRef = collection(db, ...base, 'trabajadores');
  const saludRef = collection(db, ...base, 'salud_clinica');
  const aptitudesRef = collection(db, ...base, 'aptitudes_ocupacionales');

  const [trabajadoresSnap, saludSnap, aptitudesSnap] = await Promise.all([
    getDocs(trabajadoresRef),
    getDocs(saludRef),
    getDocs(aptitudesRef)
  ]);

  const saludExistente = new Map();
  saludSnap.forEach(snap => saludExistente.set(snap.id, snap.data()));

  const aptitudesExistentes = new Map();
  aptitudesSnap.forEach(snap => aptitudesExistentes.set(snap.id, snap.data()));

  const reporte = {
    modo: dryRun ? 'DRY_RUN' : 'ESCRITURA',
    analizados: 0,
    candidatos: 0,
    migrados: 0,
    sinDatosLegacy: 0,
    yaMigrados: 0,
    conflictos: [],
    errores: []
  };

  const candidatos = [];
  trabajadoresSnap.forEach(snap => {
    if (trabajadorId && snap.id !== trabajadorId) return;
    if (limite !== null && reporte.analizados >= limite) return;

    reporte.analizados++;
    const trabajador = snap.data();
    const clinica = seleccionarCampos(trabajador, CAMPOS_CLINICOS);
    const aptitud = seleccionarCampos(trabajador, CAMPOS_APTITUD);
    const contieneClinica = tieneDatos(clinica);
    const contieneAptitud = tieneDatos(aptitud);

    if (!contieneClinica && !contieneAptitud) {
      reporte.sinDatosLegacy++;
      return;
    }

    const saludActual = saludExistente.get(snap.id);
    const aptitudActual = aptitudesExistentes.get(snap.id);

    const conflictoSalud = contieneClinica
      && saludActual
      && !datosEquivalentes(saludActual, clinica, CAMPOS_CLINICOS);
    const conflictoAptitud = contieneAptitud
      && aptitudActual
      && !datosEquivalentes(aptitudActual, aptitud, CAMPOS_APTITUD);

    if (conflictoSalud || conflictoAptitud) {
      reporte.conflictos.push({
        trabajador_id: snap.id,
        salud_clinica: conflictoSalud,
        aptitud_ocupacional: conflictoAptitud
      });
      return;
    }

    if (
      (!contieneClinica || saludActual)
      && (!contieneAptitud || aptitudActual)
    ) {
      reporte.yaMigrados++;
      return;
    }

    reporte.candidatos++;
    candidatos.push({
      id: snap.id,
      clinica,
      aptitud,
      contieneClinica,
      contieneAptitud
    });
  });

  if (dryRun) {
    console.table(reporte);
    return reporte;
  }

  for (const candidato of candidatos) {
    try {
      const batch = writeBatch(db);
      const trabajadorRef = doc(trabajadoresRef, candidato.id);

      if (candidato.contieneClinica && !saludExistente.has(candidato.id)) {
        batch.set(doc(saludRef, candidato.id), {
          ...candidato.clinica,
          trabajador_id: candidato.id,
          origen: 'migracion_legacy',
          fecha_migracion: serverTimestamp()
        });
      }

      if (candidato.contieneAptitud && !aptitudesExistentes.has(candidato.id)) {
        batch.set(doc(aptitudesRef, candidato.id), {
          ...candidato.aptitud,
          trabajador_id: candidato.id,
          origen: 'migracion_legacy',
          fecha_migracion: serverTimestamp()
        });
      }

      batch.update(trabajadorRef, {
        salud_separada_version: 1,
        fecha_migracion_salud: serverTimestamp()
      });

      await batch.commit();
      reporte.migrados++;
    } catch (error) {
      reporte.errores.push({
        trabajador_id: candidato.id,
        mensaje: error?.message || String(error)
      });
    }
  }

  console.table(reporte);
  return reporte;
}
