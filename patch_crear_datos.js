
        function crearDatosEventoHistorial(tipoEvento, titulo, detalle = {}) {
            return {
                tipo_evento: tipoEvento,
                titulo: titulo,
                fecha_evento: serverTimestamp(),
                usuario_uid: currentUser?.uid || null,
                usuario_nombre: currentUserProfile?.nombre || 'Usuario',
                usuario_rol: currentUserProfile?.rol || null,
                detalle: detalle
            };
        }
