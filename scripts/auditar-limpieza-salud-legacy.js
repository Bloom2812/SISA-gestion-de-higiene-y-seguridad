import {
  collection,
  getDocs
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

function camposPresentes(origen, campos) {
  return campos.filter(campo => Object.prototype.hasOwnProperty.call(origen, campo));
}

function valoresIguales(origen, destino, campo) {
  if (!Object.prototype.hasOwnProperty.call(destino || {}, campo)) return false;
  return JSON.stringify(origen[campo]) === JSON.stringify(destino[campo]);
}

/**
 * Audita qué campos legacy podrían eliminarse después de la migración.
 * Esta utilidad importa exclusivamente operaciones de lectura.
 */
export async function auditarLimpiezaSaludLegacy(db) {
  if (!db) throw new Error('Se requiere una instancia válida de Firestore.');

  const base = ['artifacts', APP_ID, 'public', 'data'];
  const [trabajadoresSnap, saludSnap, aptitudesSnap] = await Promise.all([
    getDocs(collection(db, ...base, 'trabajadores')),
    getDocs(collection(db, ...base, 'salud_clinica')),
    getDocs(collection(db, ...base, 'aptitudes_ocupacionales'))
  ]);

  const saludPorId = new Map();
  saludSnap.forEach(snap => saludPorId.set(snap.id, snap.data()));

  const aptitudesPorId = new Map();
  aptitudesSnap.forEach(snap => aptitudesPorId.set(snap.id, snap.data()));

  const reporte = {
    modo: 'AUDITORIA_LIMPIEZA_SOLO_LECTURA',
    analizados: 0,
    con_campos_legacy: 0,
    listos_para_limpieza: [],
    bloqueados: [],
    sin_campos_legacy: 0,
    errores: []
  };

  trabajadoresSnap.forEach(snap => {
    reporte.analizados++;
    const trabajador = snap.data();
    const clinicos = camposPresentes(trabajador, CAMPOS_CLINICOS);
    const aptitud = camposPresentes(trabajador, CAMPOS_APTITUD);

    if (clinicos.length === 0 && aptitud.length === 0) {
      reporte.sin_campos_legacy++;
      return;
    }

    reporte.con_campos_legacy++;
    const saludDestino = saludPorId.get(snap.id);
    const aptitudDestino = aptitudesPorId.get(snap.id);
    const camposDiferentes = [
      ...clinicos.filter(campo => !valoresIguales(trabajador, saludDestino, campo)),
      ...aptitud.filter(campo => !valoresIguales(trabajador, aptitudDestino, campo))
    ];
    const destinosFaltantes = [];

    if (clinicos.length > 0 && !saludDestino) destinosFaltantes.push('salud_clinica');
    if (aptitud.length > 0 && !aptitudDestino) destinosFaltantes.push('aptitud_ocupacional');

    if (
      trabajador.salud_separada_version !== 1
      || destinosFaltantes.length > 0
      || camposDiferentes.length > 0
    ) {
      reporte.bloqueados.push({
        trabajador_id: snap.id,
        marcador_migracion_valido: trabajador.salud_separada_version === 1,
        destinos_faltantes: destinosFaltantes,
        campos_diferentes: camposDiferentes
      });
      return;
    }

    reporte.listos_para_limpieza.push({
      trabajador_id: snap.id,
      campos_clinicos: clinicos,
      campos_aptitud: aptitud
    });
  });

  return reporte;
}
