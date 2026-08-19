<<<<<<< SEARCH
                if (id) {
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trabajadores', id), trabajadorData);
                    showToast('✅ Trabajador actualizado exitosamente');
                } else {
                    trabajadorData.fechaCreacion = new Date().toISOString();
                    trabajadorData.archivado = false;
                    await addDoc(coleccionTrabajadores, trabajadorData);
                    showToast('✅ Trabajador registrado exitosamente');
                }

                document.getElementById('btnVolverVistaB').click();

            } catch (error) {
                console.error("Error al guardar trabajador:", error);
                showToast('Error al guardar el trabajador', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = '✅ Guardar Trabajador';
            }
        });
=======
                const batch = writeBatch(db);

                if (id) {
                    // Editar existente
                    const trabajadorRef = doc(db, 'artifacts', appId, 'public', 'data', 'trabajadores', id);
                    const historialRefBase = collection(trabajadorRef, 'historial_ocupacional');
                    const oldT = cacheTrabajadores[id] || {};

                    // 1. CAMBIO_AREA_PUESTO
                    if (oldT.departamento !== trabajadorData.departamento || oldT.puesto_trabajo !== trabajadorData.puesto_trabajo) {
                        const eventoArea = crearDatosEventoHistorial('CAMBIO_AREA_PUESTO', 'Cambio de Área o Puesto', {
                            area_anterior: oldT.departamento || 'No definido',
                            area_nueva: trabajadorData.departamento,
                            puesto_anterior: oldT.puesto_trabajo || 'No definido',
                            puesto_nuevo: trabajadorData.puesto_trabajo
                        });
                        batch.set(doc(historialRefBase), eventoArea);
                    }

                    // 2. CAMBIO_ESTADO_LABORAL
                    if (oldT.estado_laboral !== trabajadorData.estado_laboral) {
                        const eventoEstado = crearDatosEventoHistorial('CAMBIO_ESTADO_LABORAL', 'Cambio de Estado Laboral', {
                            anterior: oldT.estado_laboral || 'No definido',
                            nuevo: trabajadorData.estado_laboral
                        });
                        batch.set(doc(historialRefBase), eventoEstado);
                    }

                    // 3. APTITUD_OCUPACIONAL
                    const aptitudCambiada =
                        oldT.aptitud_ocupacional !== trabajadorData.aptitud_ocupacional ||
                        oldT.aptitud_fecha !== trabajadorData.aptitud_fecha ||
                        oldT.aptitud_vigencia !== trabajadorData.aptitud_vigencia ||
                        oldT.aptitud_restricciones !== trabajadorData.aptitud_restricciones;

                    if (aptitudCambiada) {
                        const eventoAptitud = crearDatosEventoHistorial('APTITUD_OCUPACIONAL', 'Actualización de Aptitud Ocupacional', {
                            aptitud_anterior: oldT.aptitud_ocupacional || 'No definido',
                            aptitud_nueva: trabajadorData.aptitud_ocupacional,
                            fecha_evaluacion: trabajadorData.aptitud_fecha || null,
                            vigencia_hasta: trabajadorData.aptitud_vigencia || null,
                            restricciones: trabajadorData.aptitud_restricciones || null
                        });
                        batch.set(doc(historialRefBase), eventoAptitud);
                    }

                    batch.update(trabajadorRef, trabajadorData);

                    await batch.commit();
                    showToast('✅ Trabajador actualizado exitosamente');
                } else {
                    // Crear nuevo
                    const trabajadorRef = doc(coleccionTrabajadores);
                    trabajadorData.fechaCreacion = new Date().toISOString();
                    trabajadorData.archivado = false;

                    const eventoCreacion = crearDatosEventoHistorial('CREACION_EXPEDIENTE', 'Expediente Creado', {
                        estado_laboral: trabajadorData.estado_laboral,
                        departamento: trabajadorData.departamento,
                        puesto_trabajo: trabajadorData.puesto_trabajo,
                        aptitud_ocupacional: trabajadorData.aptitud_ocupacional
                    });

                    const historialRefBase = collection(trabajadorRef, 'historial_ocupacional');

                    batch.set(trabajadorRef, trabajadorData);
                    batch.set(doc(historialRefBase), eventoCreacion);

                    await batch.commit();
                    showToast('✅ Trabajador registrado exitosamente');
                }

                document.getElementById('btnVolverVistaB').click();

            } catch (error) {
                console.error("Error al guardar trabajador:", error);
                showToast('No fue posible guardar el cambio y su historial.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = '✅ Guardar Trabajador';
            }
        });
>>>>>>> REPLACE
