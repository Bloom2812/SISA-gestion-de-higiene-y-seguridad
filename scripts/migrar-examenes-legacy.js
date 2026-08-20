import {
    getFirestore, collection, getDocs, doc, writeBatch, serverTimestamp, deleteField
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// IMPORTANTE: Este script no está conectado en la aplicación principal y es para uso exclusivo
// de migración del modelo legacy de exámenes al modelo versión 2 (SISA-SALUD-006).

const DRY_RUN = true; // Cambiar a false solo con autorización explícita para la migración real
const APP_ID = 'sisa-mi-empresa'; // Debe coincidir con el appId de app.js

/**
 * Función para migrar un trabajador específico. Útil para pruebas iniciales o migraciones por lotes muy pequeños.
 */
export async function migrarExamenesLegacyTrabajador(db, trabajadorId) {
    console.log(`\n--- Iniciando migración para el trabajador: ${trabajadorId} ---`);

    const coleccionTrabajadores = collection(db, 'artifacts', APP_ID, 'public', 'data', 'trabajadores');
    const coleccionExamenesMedicos = collection(db, 'artifacts', APP_ID, 'public', 'data', 'examenes_medicos');

    // Simular que leemos el doc si estamos en un entorno donde podemos getDoc()
    // Como esta es una utilidad conceptual, asumimos que db es pasado como argumento.
    // ...
}

/**
 * Migra masivamente a todos los trabajadores que aún utilicen el array "examenes" (modelo legacy)
 * convirtiéndolos al modelo versión 2.
 */
export async function migrarExamenesLegacyTodos(db) {
    console.log('\n=============================================');
    console.log('MIGRACIÓN DE EXÁMENES LEGACY A VERSIÓN 2');
    console.log(`MODO: ${DRY_RUN ? 'DRY RUN (Solo lectura)' : 'PRODUCCIÓN (Escritura activa)'}`);
    console.log('=============================================');

    try {
        const coleccionTrabajadores = collection(db, 'artifacts', APP_ID, 'public', 'data', 'trabajadores');
        const coleccionExamenesMedicos = collection(db, 'artifacts', APP_ID, 'public', 'data', 'examenes_medicos');

        const snapshot = await getDocs(coleccionTrabajadores);

        let totalTrabajadores = 0;
        let totalLegacyEncontrados = 0;
        let totalExamenesLegacy = 0;
        let validosParaMigrar = 0;
        let conErrores = 0;
        let documentosACrear = 0;
        let migracionesExitosas = 0;

        const trabajadoresAMigrar = [];

        // Fase 1: Análisis y validación
        snapshot.forEach(docSnap => {
            totalTrabajadores++;
            const data = docSnap.data();
            const id = docSnap.id;

            // Ignorar los que ya están en versión 2
            if (data.examenes_version === 2) {
                return;
            }

            totalLegacyEncontrados++;

            const examenesLegacy = Array.isArray(data.examenes) ? data.examenes : [];
            totalExamenesLegacy += examenesLegacy.length;

            // Validar que cada examen esté correcto
            let valido = true;
            for (let i = 0; i < examenesLegacy.length; i++) {
                const ex = examenesLegacy[i];
                if (!ex.tipo || !ex.realizacion || !ex.vencimiento) {
                    valido = false;
                    break;
                }
            }

            if (valido) {
                validosParaMigrar++;
                documentosACrear += examenesLegacy.length;
                trabajadoresAMigrar.push({ id, data, examenesLegacy });
            } else {
                conErrores++;
                console.warn(`[ERROR] Trabajador ${id} tiene registros de exámenes incompletos o corruptos. Omitido.`);
            }
        });

        console.log('\n--- REPORTE PRELIMINAR ---');
        console.log(`Trabajadores analizados: ${totalTrabajadores}`);
        console.log(`Legacy encontrados: ${totalLegacyEncontrados}`);
        console.log(`Exámenes legacy encontrados: ${totalExamenesLegacy}`);
        console.log(`Trabajadores válidos para migrar: ${validosParaMigrar}`);
        console.log(`Trabajadores con errores: ${conErrores}`);
        console.log(`Documentos que se crearían: ${documentosACrear}`);

        if (DRY_RUN) {
            console.log('\nEjecución finalizada. Migraciones realizadas: 0 (DRY_RUN activado).');
            return;
        }

        // Fase 2: Ejecución Real de la Migración
        console.log('\n--- INICIANDO MIGRACIÓN REAL ---');

        for (const t of trabajadoresAMigrar) {
            const batch = writeBatch(db);
            const trabajadorRef = doc(coleccionTrabajadores, t.id);

            t.examenesLegacy.forEach((examen, index) => {
                // Generar ID determinista: legacy_{trabajadorId}_{indice}
                const examenId = `legacy_${t.id}_${index}`;
                const examenRef = doc(coleccionExamenesMedicos, examenId);

                batch.set(examenRef, {
                    trabajador_id: t.id,
                    tipo: examen.tipo,
                    realizacion: examen.realizacion,
                    vencimiento: examen.vencimiento,
                    origen: 'migracion_legacy',
                    indice_legacy: index,
                    fecha_migracion: serverTimestamp()
                });
            });

            // Actualizar el documento principal del trabajador
            batch.update(trabajadorRef, {
                examenes_version: 2,
                fecha_migracion_examenes: serverTimestamp(),
                examenes: deleteField() // Remueve el array antiguo
            });

            try {
                await batch.commit();
                migracionesExitosas++;
                console.log(`[EXITO] Trabajador ${t.id} migrado correctamente.`);
            } catch (err) {
                console.error(`[FALLO] No se pudo migrar el trabajador ${t.id}:`, err);
            }
        }

        console.log('\n--- REPORTE FINAL ---');
        console.log(`Migraciones intentadas: ${validosParaMigrar}`);
        console.log(`Migraciones exitosas: ${migracionesExitosas}`);

    } catch (error) {
        console.error("Error al procesar la migración masiva:", error);
    }
}
