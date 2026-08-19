// --- FUNCIONES HISTORIAL OCUPACIONAL ---
        function formatFecha(timestampOrString) {
            if (!timestampOrString) return '';
            const date = timestampOrString.toDate ? timestampOrString.toDate() : new Date(timestampOrString);
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        async function abrirHistorialOcupacional(id) {
            const t = cacheTrabajadores[id];
            if(!t) return;

            document.getElementById('vista-b-trabajadores').style.display = 'none';
            document.getElementById('vista-a-registro').style.display = 'none';
            document.getElementById('vista-c-perfil').style.display = 'none';
            document.getElementById('vista-d-historial').style.display = 'block';

            document.getElementById('historialTrabajadorNombre').textContent = `${t.nombres} ${t.apellidos}`;
            document.getElementById('historialTrabajadorPuesto').textContent = `${t.puesto_trabajo} | ${t.departamento}`;

            const timelineContainer = document.getElementById('historialTimeline');
            timelineContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #6b7280;">Cargando historial...</div>';

            try {
                const historialRef = collection(db, 'artifacts', appId, 'public', 'data', 'trabajadores', id, 'historial_ocupacional');
                const q = query(historialRef, orderBy('fecha_evento', 'desc'));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    timelineContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #6b7280;">No existen eventos ocupacionales registrados para este trabajador.<br><br>El historial se genera a partir de la habilitación de esta funcionalidad.</div>';
                    return;
                }

                timelineContainer.innerHTML = '';

                snapshot.forEach(docSnap => {
                    const evento = docSnap.data();
                    let icon = '📝';
                    let descriptionHtml = '';

                    switch(evento.tipo_evento) {
                        case 'CREACION_EXPEDIENTE':
                            icon = '👤';
                            descriptionHtml = `Expediente ocupacional registrado.<br>`;
                            if (evento.detalle) {
                                descriptionHtml += `<div class="timeline-detail">
                                    Área: ${evento.detalle.departamento || '-'} / Puesto: ${evento.detalle.puesto_trabajo || '-'}<br>
                                    Estado: ${evento.detalle.estado_laboral || '-'}<br>
                                    Aptitud: ${evento.detalle.aptitud_ocupacional || '-'}
                                </div>`;
                            }
                            break;
                        case 'CAMBIO_AREA_PUESTO':
                            icon = '🏢';
                            const dArea = evento.detalle.area_anterior !== evento.detalle.area_nueva;
                            const dPuesto = evento.detalle.puesto_anterior !== evento.detalle.puesto_nuevo;

                            if (dArea && dPuesto) {
                                descriptionHtml = `Área: ${evento.detalle.area_anterior} → <strong>${evento.detalle.area_nueva}</strong><br>Puesto: ${evento.detalle.puesto_anterior} → <strong>${evento.detalle.puesto_nuevo}</strong>`;
                            } else if (dArea) {
                                descriptionHtml = `Área: ${evento.detalle.area_anterior} → <strong>${evento.detalle.area_nueva}</strong>`;
                            } else if (dPuesto) {
                                descriptionHtml = `Puesto: ${evento.detalle.puesto_anterior} → <strong>${evento.detalle.puesto_nuevo}</strong>`;
                            } else {
                                descriptionHtml = `Área / Puesto actualizado.`;
                            }
                            break;
                        case 'CAMBIO_ESTADO_LABORAL':
                            icon = '💼';
                            descriptionHtml = `Estado laboral: ${evento.detalle.anterior} → <strong>${evento.detalle.nuevo}</strong>`;
                            break;
                        case 'APTITUD_OCUPACIONAL':
                            icon = '🩺';
                            descriptionHtml = `Aptitud: ${evento.detalle.aptitud_anterior || '-'} → <strong>${evento.detalle.aptitud_nueva || '-'}</strong>`;
                            if (evento.detalle.restricciones) {
                                descriptionHtml += `<div class="timeline-detail">Restricciones: ${evento.detalle.restricciones}</div>`;
                            }
                            break;
                        case 'ARCHIVADO_EXPEDIENTE':
                            icon = '📦';
                            descriptionHtml = `Expediente archivado.<div class="timeline-detail">Motivo: ${evento.detalle.motivo || '-'}</div>`;
                            break;
                        case 'RESTAURACION_EXPEDIENTE':
                            icon = '↩️';
                            descriptionHtml = `Expediente restaurado al directorio activo.`;
                            break;
                        default:
                            icon = '📝';
                            descriptionHtml = `Evento registrado.`;
                    }

                    const itemHtml = `
                        <div class="timeline-item">
                            <div class="timeline-marker">${icon}</div>
                            <div class="timeline-content">
                                <div class="timeline-header">
                                    <div class="timeline-title">${evento.titulo || 'Evento Ocupacional'}</div>
                                    <div class="timeline-date">${formatFecha(evento.fecha_evento)}</div>
                                </div>
                                <div class="timeline-detail">
                                    ${descriptionHtml}
                                </div>
                                <div class="timeline-user">
                                    <span>Registrado por: ${evento.usuario_nombre} ${evento.usuario_rol ? `(${evento.usuario_rol})` : ''}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    timelineContainer.insertAdjacentHTML('beforeend', itemHtml);
                });

            } catch (error) {
                console.error("Error al cargar historial ocupacional:", error);
                timelineContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #ef4444;">Error al cargar el historial.</div>';
            }
        }

        document.getElementById('btnVolverHistorial').addEventListener('click', () => {
            document.getElementById('vista-d-historial').style.display = 'none';
            document.getElementById('vista-b-trabajadores').style.display = 'block';
        });
