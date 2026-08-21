        // Importaciones de Firebase (Mandatorias para este entorno)
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc, query, where, getDocs, getDoc, writeBatch, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // ==========================================================
        // ⚠️ PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE ⚠️
        // Reemplaza esto con los datos que copiaste de la consola
        // ==========================================================
        const firebaseConfig = {
            apiKey: "AIzaSyDFOFzd_2kYIXK153eCnsGrxjGrNDG3vdI",
            authDomain: "gestion-de-mantenimiento-dev.firebaseapp.com",
            projectId: "gestion-de-mantenimiento-dev",
            storageBucket: "gestion-de-mantenimiento-dev.firebasestorage.app",
            messagingSenderId: "440255998178",
            appId: "1:440255998178:web:72e172d08a8a015970d6bb"
        };

        const appId = 'sisa-mi-empresa'; // Puedes cambiar esto por el nombre de tu empresa

        // Iniciar Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);

        // Secondary App para crear usuarios sin afectar la sesión principal
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);

        const db = getFirestore(app);

        // Variables de estado
        let currentUser = null;
        let currentUserProfile = null;
        let unsubscribeRiesgos = null;
        let unsubscribeUsuarios = null;
        let unsubscribeIncidentes = null;
        let unsubscribeCapacitaciones = null;

        const ROLES_VALIDOS = [
            'Administrador',
            'Gerencia',
            'Responsable H&S',
            'Médico Ocupacional',
            'Supervisor',
            'Trabajador'
        ];

        // ============================================================
        // 1.1 PERMISOS DE INTERFAZ
        // ============================================================
        function aplicarPermisosInterfaz() {
            const navConfiguracion = document.getElementById('navConfiguracion');
            const navSalud = document.getElementById('navSaludOcupacional');
            if (!navConfiguracion || !navSalud) return;

            const rol = currentUserProfile?.rol;
            const puedeAccederSalud = ['Médico Ocupacional', 'Responsable H&S'].includes(rol);

            navConfiguracion.style.display = rol === 'Administrador' ? '' : 'none';
            navSalud.style.display = puedeAccederSalud ? '' : 'none';

            const paginaRestringidaActiva =
                (document.getElementById('page-configuracion')?.classList.contains('active') && rol !== 'Administrador')
                || (document.getElementById('page-salud')?.classList.contains('active') && !puedeAccederSalud);

            if (paginaRestringidaActiva) {
                document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                document.getElementById('page-dashboard').classList.add('active');
                document.querySelector('.nav-item[data-page="dashboard"]')?.classList.add('active');
            }

            aplicarPermisosSalud();
            const btnNuevoIncidente = document.getElementById('btnNuevoIncidente');
            if (btnNuevoIncidente) btnNuevoIncidente.style.display = ['Administrador', 'Responsable H&S'].includes(rol) ? '' : 'none';
            const btnNuevaCapacitacion = document.getElementById('btnNuevaCapacitacion');
            if (btnNuevaCapacitacion) btnNuevaCapacitacion.style.display = ['Administrador', 'Responsable H&S'].includes(rol) ? '' : 'none';
        }

        function aplicarPermisosSalud() {
            const rol = currentUserProfile?.rol;
            const esMedico = rol === 'Médico Ocupacional';
            const esResponsableHS = rol === 'Responsable H&S';

            const botonPasoMedico = document.getElementById('wizardBtnDatosMedicos');
            const botonPasoExamenes = document.getElementById('wizardBtnExamenes');
            const seccionAptitud = document.getElementById('seccionEdicionAptitud');
            const perfilClinico = document.getElementById('seccionPerfilClinico');
            const observacionesClinicas = document.getElementById('perfilAptitudObservaciones');

            if (botonPasoMedico) botonPasoMedico.style.display = esMedico ? '' : 'none';
            if (seccionAptitud) seccionAptitud.style.display = esMedico ? '' : 'none';
            if (perfilClinico) perfilClinico.style.display = esMedico ? '' : 'none';
            if (observacionesClinicas) observacionesClinicas.style.display = esMedico ? '' : 'none';

            if (botonPasoExamenes) {
                botonPasoExamenes.textContent = esResponsableHS ? '2. Exámenes y EPP' : '3. Exámenes y EPP';
            }
        }

        // ============================================================
        // 2. OBTENER PERFIL DE USUARIO
        // ============================================================
        async function obtenerPerfilUsuario(uid) {
            const userRef = doc(
                db,
                'artifacts',
                appId,
                'public',
                'data',
                'usuarios',
                uid
            );

            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                return null;
            }

            return {
                id: userSnap.id,
                ...userSnap.data()
            };
        }

        // ============================================================
        // 3. SISTEMA DE AUTENTICACIÓN
        // ============================================================
        function showToast(message, type = 'success') {
            document.querySelectorAll('.custom-toast').forEach(t => t.remove());
            const toast = document.createElement('div');
            toast.className = 'custom-toast';
            const bgColor = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6';
            toast.style.cssText = `
                position: fixed; bottom: 24px; right: 24px;
                padding: 14px 24px; border-radius: 12px;
                background: ${bgColor}; color: #fff; font-weight: 500;
                box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 9999;
                animation: fadeIn 0.3s ease; max-width: 400px; font-size: 15px;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        function escapeHtml(valor) {
            return String(valor ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        function urlImagenSegura(valor) {
            const url = String(valor ?? '').trim();
            if (/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(url)) return url;
            if (/^https:\/\//i.test(url)) return url;
            return '';
        }

        // ============================================================
        // 2. AUTENTICACIÓN (LOGIN/LOGOUT CON FIREBASE)
        // ============================================================

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const btn = document.getElementById('loginBtn');
            const errorElement = document.getElementById('loginError');

            errorElement.classList.remove('show');
            emailInput.classList.remove('error');
            passwordInput.classList.remove('error');

            btn.disabled = true;
            btn.textContent = '⏳ Iniciando sesión...';

            try {
                await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
                // onAuthStateChanged manejará el éxito
            } catch (error) {
                console.error("Error Auth Firebase:", error);
                errorElement.classList.add('show');
                emailInput.classList.add('error');
                passwordInput.classList.add('error');
                document.getElementById('errorText').textContent = 'Credenciales incorrectas';
                btn.disabled = false;
                btn.textContent = '🚀 Iniciar Sesión';
            }
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
                signOut(auth); // Cierra sesión en Firebase
            }
        });

        // Observador de estado de autenticación
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;

                try {
                    currentUserProfile = await obtenerPerfilUsuario(user.uid);

                    if (!currentUserProfile) {
                        showToast('No existe un perfil de usuario autorizado para esta cuenta. Contacte al administrador.', 'error');
                        await signOut(auth);
                        return;
                    }

                    if (!currentUserProfile.rol || !ROLES_VALIDOS.includes(currentUserProfile.rol)) {
                        showToast('El usuario no tiene un rol válido asignado. Contacte al administrador.', 'error');
                        await signOut(auth);
                        return;
                    }

                    // Actualizar UI del usuario
                    document.getElementById('userNameDisplay').textContent = currentUserProfile.nombre;
                    document.getElementById('userRoleDisplay').textContent = currentUserProfile.rol;

                    // Aplicar permisos visuales antes de transicionar
                    aplicarPermisosInterfaz();

                    // Transición al Dashboard
                    document.getElementById('loginContainer').classList.add('hidden');
                    document.getElementById('appContainer').classList.add('show');
                    showToast('✅ Conectado exitosamente');
                    document.getElementById('loginBtn').disabled = false;
                    document.getElementById('loginBtn').textContent = '🚀 Iniciar Sesión';

                    // Iniciar la escucha de datos
                    iniciarSuscripcionRiesgos();
                    iniciarSuscripcionAreas();
                    iniciarSuscripcionIncidentes();
                    iniciarSuscripcionCapacitaciones();
                    if (['Médico Ocupacional', 'Responsable H&S'].includes(currentUserProfile.rol)) {
                        iniciarSuscripcionTrabajadores();
                        iniciarSuscripcionExamenesMedicos();
                        iniciarSuscripcionAptitudesOcupacionales();

                        if (esMedicoOcupacional()) {
                            iniciarSuscripcionSaludClinica();
                        } else {
                            saludClinicaCargada = true;
                        }
                    }

                    if (currentUserProfile.rol === 'Administrador') {
                        iniciarSuscripcionUsuarios();
                    }

                } catch (error) {
                    console.error("Error al cargar perfil de usuario:", error);
                    showToast('No fue posible cargar el perfil del usuario.', 'error');
                    await signOut(auth);
                }
            } else {
                currentUser = null;
                currentUserProfile = null;

                const navConfiguracion = document.getElementById('navConfiguracion');
                if (navConfiguracion) {
                    navConfiguracion.style.display = 'none';
                }

                // Limpiar UI del usuario
                document.getElementById('userNameDisplay').textContent = 'Usuario';
                document.getElementById('userRoleDisplay').textContent = '-';

                // Transición de vuelta al Login
                document.getElementById('appContainer').classList.remove('show');
                document.getElementById('loginContainer').classList.remove('hidden');
                document.getElementById('password').value = '';

                // Detener escucha de datos para ahorrar recursos
                if(unsubscribeRiesgos) unsubscribeRiesgos();
                if(unsubscribeUsuarios) unsubscribeUsuarios();
                if(unsubscribeAreas) unsubscribeAreas();
                if(unsubscribeTrabajadores) unsubscribeTrabajadores();
                if(unsubscribeExamenesMedicos) unsubscribeExamenesMedicos();
                if(unsubscribeSaludClinica) unsubscribeSaludClinica();
                if(unsubscribeAptitudesOcupacionales) unsubscribeAptitudesOcupacionales();
                if(unsubscribeIncidentes) unsubscribeIncidentes();
                if(unsubscribeCapacitaciones) unsubscribeCapacitaciones();

                unsubscribeRiesgos = null;
                unsubscribeUsuarios = null;
                unsubscribeAreas = null;
                unsubscribeTrabajadores = null;
                unsubscribeExamenesMedicos = null;
                unsubscribeSaludClinica = null;
                unsubscribeAptitudesOcupacionales = null;
                unsubscribeIncidentes = null;
                unsubscribeCapacitaciones = null;
                cacheTrabajadoresBase = {};
                cacheSaludClinica = {};
                cacheAptitudesOcupacionales = {};
                cacheExamenesPorTrabajador = {};
            }
        });

        // ============================================================
        // 3. CONEXIÓN A FIRESTORE (MÓDULO: RIESGOS)
        // ============================================================
        // Regla Obligatoria: Usar ruta /artifacts/{appId}/public/data/{collectionName}
        const coleccionRiesgos = collection(db, 'artifacts', appId, 'public', 'data', 'riesgos');

        // Escuchar datos en tiempo real
        function iniciarSuscripcionRiesgos() {
            if (!currentUser) return; // Regla obligatoria: Comprobar autenticación

            unsubscribeRiesgos = onSnapshot(coleccionRiesgos, (snapshot) => {
                const tbody = document.getElementById('riesgosTableBody');
                tbody.innerHTML = ''; // Limpiar tabla

                if (snapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay riesgos registrados. ¡Buen trabajo!</td></tr>';
                    return;
                }

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const id = docSnap.id;

                    // Cálculo de Nivel de Riesgo (Probabilidad * Severidad)
                    const nivel = data.probabilidad * data.severidad;
                    let badgeClass = 'badge-success';
                    let badgeText = 'BAJO';

                    if(nivel > 50) { badgeClass = 'badge-danger'; badgeText = 'CRÍTICO'; }
                    else if(nivel > 25) { badgeClass = 'badge-warning'; badgeText = 'MEDIO'; }

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${data.area}</strong></td>
                        <td>${data.peligro}</td>
                        <td style="text-align:center;">
                            <span class="badge ${badgeClass}">${badgeText} (${nivel})</span>
                        </td>
                        <td>${data.responsable}</td>
                        <td>
                            <button class="btn btn-sm btn-danger btn-eliminar" data-id="${id}">🗑️</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                // Asignar eventos de eliminar
                document.querySelectorAll('.btn-eliminar').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.target.getAttribute('data-id');
                        if(confirm('¿Eliminar este riesgo de la base de datos?')) {
                            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'riesgos', id));
                            showToast('🗑️ Riesgo eliminado');
                        }
                    });
                });

            }, (error) => {
                console.error("Error de Snapshot:", error);
                showToast("Error al leer datos en tiempo real", "error");
            });
        }

        // Guardar nuevo Riesgo en Firebase
        document.getElementById('formRiesgo').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const btn = document.getElementById('btnSubmitRiesgo');
            btn.disabled = true;
            btn.textContent = '⏳ Guardando...';

            const nuevoRiesgo = {
                area: document.getElementById('r_area').value,
                peligro: document.getElementById('r_peligro').value,
                probabilidad: parseInt(document.getElementById('r_probabilidad').value),
                severidad: parseInt(document.getElementById('r_severidad').value),
                responsable: document.getElementById('r_responsable').value,
                fechaCreacion: new Date().toISOString()
            };

            try {
                await addDoc(coleccionRiesgos, nuevoRiesgo);
                showToast('✅ Riesgo guardado en Firebase exitosamente');
                hideModal('modalRiesgo');
                e.target.reset();
            } catch (error) {
                console.error("Error al guardar:", error);
                showToast('Error al guardar en base de datos', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = '✅ Guardar en Firebase';
            }
        });

        // ============================================================
        // 4. MÓDULO DE USUARIOS Y ÁREAS (CREACIÓN, EDICIÓN Y LISTADO)
        // ============================================================
        const coleccionUsuarios = collection(db, 'artifacts', appId, 'public', 'data', 'usuarios');
        const coleccionAreas = collection(db, 'artifacts', appId, 'public', 'data', 'areas');
        let unsubscribeAreas = null;
        let cacheAreas = {};

        function iniciarSuscripcionUsuarios() {
            if (!currentUser) return;

            unsubscribeUsuarios = onSnapshot(coleccionUsuarios, (snapshot) => {
                const tbody = document.getElementById('usuariosTableBody');
                tbody.innerHTML = '';

                if (snapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay usuarios registrados.</td></tr>';
                    return;
                }

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const id = docSnap.id;

                    let badgeClass = 'badge-gray';
                    if(data.rol === 'Administrador') badgeClass = 'badge-purple';
                    else if(data.rol === 'Gerencia') badgeClass = 'badge-info';
                    else if(data.rol === 'Responsable H&S') badgeClass = 'badge-success';
                    else if(data.rol === 'Supervisor') badgeClass = 'badge-warning';

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${data.nombre}</strong></td>
                        <td>${data.correo}</td>
                        <td><span class="badge ${badgeClass}">${data.rol}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline btn-editar-usr" data-id="${id}" data-nombre="${data.nombre}" data-correo="${data.correo}" data-rol="${data.rol}">✏️</button>
                            ${data.correo !== 'admin@sisa.com' ? `<button class="btn btn-sm btn-danger btn-eliminar-usr" data-id="${id}">🗑️</button>` : ''}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                // Asignar eventos a los botones generados
                document.querySelectorAll('.btn-editar-usr').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const target = e.currentTarget;
                        document.getElementById('u_id').value = target.getAttribute('data-id');
                        document.getElementById('u_nombre').value = target.getAttribute('data-nombre');
                        document.getElementById('u_correo').value = target.getAttribute('data-correo');
                        document.getElementById('u_correo').disabled = true; // No permitir cambiar correo editando
                        document.getElementById('u_rol').value = target.getAttribute('data-rol');

                        document.getElementById('u_password_group').style.display = 'none';
                        document.getElementById('u_password').required = false;

                        document.getElementById('modalUsuarioTitle').textContent = '✏️ Editar Usuario';
                        showModal('modalUsuario');
                    });
                });

                document.querySelectorAll('.btn-eliminar-usr').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.currentTarget.getAttribute('data-id');
                        if(confirm('¿Eliminar este usuario del sistema?\nNota: Esto solo borra su perfil de Firestore, para revocar acceso real debe borrarse de Firebase Auth.')) {
                            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usuarios', id));
                            showToast('🗑️ Usuario eliminado');
                        }
                    });
                });
            }, (error) => {
                console.error("Error de Snapshot en Usuarios:", error);
                showToast("Error al leer lista de usuarios", "error");
            });
        }

        // Crear o Editar Usuario
        document.getElementById('formUsuario').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const btn = document.getElementById('btnSubmitUsuario');
            btn.disabled = true;
            btn.textContent = '⏳ Guardando...';

            const id = document.getElementById('u_id').value;
            const nombre = document.getElementById('u_nombre').value;
            const correo = document.getElementById('u_correo').value;
            const rol = document.getElementById('u_rol').value;

            try {
                if (id) {
                    // Editar existente
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usuarios', id), {
                        nombre: nombre,
                        rol: rol,
                        fechaActualizacion: new Date().toISOString()
                    });
                    showToast('✅ Usuario actualizado exitosamente');
                } else {
                    // Crear nuevo
                    const password = document.getElementById('u_password').value;

                    // 1. Crear usuario en Firebase Auth usando secondaryApp para no cerrar sesión actual
                    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, correo, password);
                    const newUser = userCredential.user;

                    // 2. Guardar perfil en Firestore
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usuarios', newUser.uid), {
                        nombre: nombre,
                        correo: correo,
                        rol: rol,
                        uid: newUser.uid,
                        fechaCreacion: new Date().toISOString()
                    });

                    // 3. Desloguear la secondary app por seguridad
                    await signOut(secondaryAuth);

                    showToast('✅ Usuario creado exitosamente');
                }

                hideModal('modalUsuario');
                e.target.reset();
            } catch (error) {
                console.error("Error al guardar usuario:", error);
                if (error.code === 'auth/email-already-in-use') {
                    showToast('El correo ya está en uso', 'error');
                } else if (error.code === 'auth/weak-password') {
                    showToast('La contraseña debe tener al menos 6 caracteres', 'error');
                } else {
                    showToast('Error al guardar el usuario', 'error');
                }
            } finally {
                btn.disabled = false;
                btn.textContent = '✅ Guardar Usuario';
            }
        });

        // Configurar botón "Nuevo Usuario" para limpiar el modal
        document.getElementById('btnNuevoUsuario').addEventListener('click', () => {
            document.getElementById('formUsuario').reset();
            document.getElementById('u_id').value = '';
            document.getElementById('u_correo').disabled = false;

            document.getElementById('u_password_group').style.display = 'block';
            document.getElementById('u_password').required = true;

            document.getElementById('modalUsuarioTitle').textContent = '👤 Nuevo Usuario';
            showModal('modalUsuario');
        });

        // ------------------ MÓDULO DE ÁREAS ------------------
        function iniciarSuscripcionAreas() {
            if (!currentUser) return;

            unsubscribeAreas = onSnapshot(coleccionAreas, (snapshot) => {
                const tbody = document.getElementById('areasTableBody');
                tbody.innerHTML = '';
                cacheAreas = {};

                if (snapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No hay áreas registradas.</td></tr>';
                    actualizarOpcionesIncidentes();
                    return;
                }

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const id = docSnap.id;
                    cacheAreas[id] = { id, ...data };

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${data.nombre}</strong></td>
                        <td>
                            <button class="btn btn-sm btn-outline btn-editar-area" data-id="${id}" data-nombre="${data.nombre}">✏️</button>
                            <button class="btn btn-sm btn-danger btn-eliminar-area" data-id="${id}">🗑️</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                document.querySelectorAll('.btn-editar-area').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const target = e.currentTarget;
                        document.getElementById('a_id').value = target.getAttribute('data-id');
                        document.getElementById('a_nombre').value = target.getAttribute('data-nombre');

                        document.getElementById('modalAreaTitle').textContent = '✏️ Editar Área';
                        showModal('modalArea');
                    });
                });
                actualizarOpcionesIncidentes();

                document.querySelectorAll('.btn-eliminar-area').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.currentTarget.getAttribute('data-id');
                        if(confirm('¿Eliminar esta área del sistema?')) {
                            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'areas', id));
                            showToast('🗑️ Área eliminada');
                        }
                    });
                });
            }, (error) => {
                console.error("Error de Snapshot en Áreas:", error);
                showToast("Error al leer lista de áreas", "error");
            });
        }

        // Crear o Editar Área
        document.getElementById('formArea').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const btn = document.getElementById('btnSubmitArea');
            btn.disabled = true;
            btn.textContent = '⏳ Guardando...';

            const id = document.getElementById('a_id').value;
            const nombre = document.getElementById('a_nombre').value;

            try {
                if (id) {
                    // Editar existente
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'areas', id), {
                        nombre: nombre,
                        fechaActualizacion: new Date().toISOString()
                    });
                    showToast('✅ Área actualizada exitosamente');
                } else {
                    // Crear nuevo
                    await addDoc(coleccionAreas, {
                        nombre: nombre,
                        fechaCreacion: new Date().toISOString()
                    });
                    showToast('✅ Área creada exitosamente');
                }

                hideModal('modalArea');
                e.target.reset();
            } catch (error) {
                console.error("Error al guardar área:", error);
                showToast('Error al guardar el área', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = '✅ Guardar Área';
            }
        });

        // Configurar botón "Nueva Área" para limpiar el modal
        document.getElementById('btnNuevaArea').addEventListener('click', () => {
            document.getElementById('formArea').reset();
            document.getElementById('a_id').value = '';

            document.getElementById('modalAreaTitle').textContent = '🏢 Nueva Área';
            showModal('modalArea');
        });


        // ============================================================
        // 5. MÓDULO DE TRABAJADORES (EXPEDIENTES Y SALUD)
        // ============================================================
        const coleccionTrabajadores = collection(db, 'artifacts', appId, 'public', 'data', 'trabajadores');
        let unsubscribeTrabajadores = null;

        const coleccionExamenesMedicos = collection(db, 'artifacts', appId, 'public', 'data', 'examenes_medicos');
        const coleccionSaludClinica = collection(db, 'artifacts', appId, 'public', 'data', 'salud_clinica');
        const coleccionAptitudesOcupacionales = collection(db, 'artifacts', appId, 'public', 'data', 'aptitudes_ocupacionales');

        let unsubscribeExamenesMedicos = null;
        let unsubscribeSaludClinica = null;
        let unsubscribeAptitudesOcupacionales = null;

        let cacheExamenesPorTrabajador = {};
        let cacheTrabajadoresBase = {};
        let cacheSaludClinica = {};
        let cacheAptitudesOcupacionales = {};

        function esMedicoOcupacional() {
            return currentUserProfile?.rol === 'Médico Ocupacional';
        }

        function reconstruirCacheTrabajadores() {
            cacheTrabajadores = {};

            Object.entries(cacheTrabajadoresBase).forEach(([id, base]) => {
                const trabajador = { ...base, id };

                if (esMedicoOcupacional()) {
                    Object.assign(trabajador, cacheSaludClinica[id] || {});
                } else {
                    // Evita mostrar campos clínicos heredados al Responsable H&S.
                    [
                        'tipo_sangre',
                        'alergias',
                        'condiciones_medicas',
                        'emergencia_contacto_nombre',
                        'emergencia_contacto_parentesco',
                        'emergencia_contacto_telefono',
                        'aptitud_observaciones'
                    ].forEach(campo => delete trabajador[campo]);
                }

                Object.assign(trabajador, cacheAptitudesOcupacionales[id] || {});
                cacheTrabajadores[id] = trabajador;
            });
        }

        function obtenerExamenesTrabajador(t) {
            const nuevos = cacheExamenesPorTrabajador[t.id] || [];

            if (t.examenes_version === 2) {
                return nuevos;
            }

            const legacy = Array.isArray(t.examenes) ? t.examenes : [];
            return [...legacy, ...nuevos];
        }

        // Variables en memoria para listas dinámicas (Paso 2 y 3)
        let t_alergias_array = [];
        let t_condiciones_array = [];
        let t_examenes_array = [];

        // Funciones para poblar Select de Áreas
        async function poblarSelectAreas() {
            const select = document.getElementById('t_departamento');
            select.innerHTML = '<option value="">Selecciona un área...</option>';
            try {
                const snapshot = await getDocs(coleccionAreas);
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const option = document.createElement('option');
                    option.value = data.nombre;
                    option.textContent = data.nombre;
                    select.appendChild(option);
                });
            } catch (error) {
                console.error("Error al cargar áreas:", error);
            }
        }

        // --- NAVEGACIÓN ENTRE VISTAS DEL MÓDULO ---
        document.getElementById('btnNuevoTrabajador').addEventListener('click', async () => {
            document.getElementById('vista-b-trabajadores').style.display = 'none';
            document.getElementById('vista-c-perfil').style.display = 'none';
            document.getElementById('vista-a-registro').style.display = 'block';

            document.getElementById('vista-a-titulo').textContent = '📝 Nuevo Trabajador';
            document.getElementById('formTrabajador').reset();
            document.getElementById('t_id').value = '';
            actualizarCamposAptitud();

            // Reset Arrays
            t_alergias_array = [];
            t_condiciones_array = [];
            t_examenes_array = [];
            renderArrays();

            // Disable tabs initially
            document.querySelectorAll('.wizard-step-btn').forEach(btn => {
                if(btn.dataset.step !== '1') btn.disabled = true;
            });

            await poblarSelectAreas();
            aplicarPermisosSalud();
            mostrarPasoWizard(1);
        });

        document.getElementById('btnVolverVistaB').addEventListener('click', () => {
            document.getElementById('vista-a-registro').style.display = 'none';
            document.getElementById('vista-c-perfil').style.display = 'none';
            document.getElementById('vista-b-trabajadores').style.display = 'block';
        });

        document.getElementById('btnVolverVistaC').addEventListener('click', () => {
            document.getElementById('vista-a-registro').style.display = 'none';
            document.getElementById('vista-c-perfil').style.display = 'none';
            document.getElementById('vista-b-trabajadores').style.display = 'block';
        });

        // --- NAVEGACIÓN DEL WIZARD (FORMULARIO) ---
        function mostrarPasoWizard(paso) {
            document.querySelectorAll('.wizard-content').forEach(el => el.style.display = 'none');
            document.getElementById(`wizard-step-${paso}`).style.display = 'block';

            document.querySelectorAll('.wizard-step-btn').forEach(btn => {
                if(btn.dataset.step === paso.toString()) {
                    btn.classList.remove('btn-outline');
                    btn.classList.add('btn-primary');
                } else {
                    btn.classList.add('btn-outline');
                    btn.classList.remove('btn-primary');
                }
            });
        }

        document.querySelectorAll('.btn-next-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestedStep = parseInt(e.currentTarget.dataset.next);
                const currentStep = requestedStep - 1;
                const nextStep = currentUserProfile?.rol === 'Responsable H&S' && requestedStep === 2 ? 3 : requestedStep;
                const currentDiv = document.getElementById(`wizard-step-${currentStep}`);
                const inputsObligatorios = currentDiv.querySelectorAll('[required]');
                let valido = true;
                inputsObligatorios.forEach(input => {
                    if(!input.reportValidity()) valido = false;
                });

                if(valido) {
                    const nextStepBtn = document.querySelector(`.wizard-step-btn[data-step="${nextStep}"]`);
                    if(nextStepBtn) nextStepBtn.disabled = false;
                    mostrarPasoWizard(nextStep);
                }
            });
        });

        document.querySelectorAll('.btn-prev-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestedStep = parseInt(e.currentTarget.dataset.prev);
                const prevStep = currentUserProfile?.rol === 'Responsable H&S' && requestedStep === 2 ? 1 : requestedStep;
                mostrarPasoWizard(prevStep);
            });
        });

        document.querySelectorAll('.wizard-step-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // If button is disabled, don't change step
                if (e.currentTarget.disabled) return;

                // If it is enabled, make sure previous steps were valid first
                const targetStep = parseInt(e.currentTarget.dataset.step);
                const currentStep = 1; // Actually in a real scenario you would check current step. But since tabs are enabled sequentially, we just allow it.

                mostrarPasoWizard(targetStep);
            });
        });

        // --- LÓGICA DE UI DE APTITUD ---
        function actualizarCamposAptitud() {
            const selectAptitud = document.getElementById('t_aptitud_ocupacional');
            const valorAptitud = selectAptitud.value;
            const containerRestricciones = document.getElementById('container_aptitud_restricciones');
            const inputRestricciones = document.getElementById('t_aptitud_restricciones');
            const inputFecha = document.getElementById('t_aptitud_fecha');

            if (valorAptitud === 'Apto con restricciones') {
                containerRestricciones.style.display = '';
                inputRestricciones.required = true;
                inputFecha.required = true;
            } else {
                containerRestricciones.style.display = 'none';
                inputRestricciones.required = false;
                inputRestricciones.value = '';

                if (valorAptitud === 'Pendiente de evaluación') {
                    inputFecha.required = false;
                } else {
                    inputFecha.required = true; // Apto o No apto temporalmente
                }
            }
        }

        document.getElementById('t_aptitud_ocupacional').addEventListener('change', actualizarCamposAptitud);

        // --- LISTAS DINÁMICAS (ALERGIAS, CONDICIONES, EXÁMENES) ---
        function renderArrays() {
            // Alergias
            const ulAlergias = document.getElementById('t_alergias_list');
            ulAlergias.innerHTML = '';
            t_alergias_array.forEach((alergia, index) => {
                const li = document.createElement('li');
                li.innerHTML = `${escapeHtml(alergia)} <button type="button" class="btn btn-sm btn-danger ml-2" onclick="window.removeAlergia(${index})">x</button>`;
                li.style.marginBottom = '5px';
                ulAlergias.appendChild(li);
            });

            // Condiciones
            const ulCondiciones = document.getElementById('t_condiciones_list');
            ulCondiciones.innerHTML = '';
            t_condiciones_array.forEach((condicion, index) => {
                const li = document.createElement('li');
                li.innerHTML = `${escapeHtml(condicion)} <button type="button" class="btn btn-sm btn-danger ml-2" onclick="window.removeCondicion(${index})">x</button>`;
                li.style.marginBottom = '5px';
                ulCondiciones.appendChild(li);
            });

            // Exámenes
            const tbodyExamenes = document.getElementById('t_examenes_list');
            tbodyExamenes.innerHTML = '';
            if(t_examenes_array.length === 0) {
                tbodyExamenes.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay exámenes agregados</td></tr>';
            } else {
                t_examenes_array.forEach((ex, index) => {
                    const tr = document.createElement('tr');
                    const accionHtml = (ex.origen_ui === 'nuevo')
                        ? `<button type="button" class="btn btn-sm btn-danger" onclick="window.removeExamen(${index})">🗑️</button>`
                        : `<span class="badge badge-info">Registrado</span>`;

                    tr.innerHTML = `
                        <td>${escapeHtml(ex.tipo)}</td>
                        <td>${escapeHtml(ex.realizacion)}</td>
                        <td>${escapeHtml(ex.vencimiento)}</td>
                        <td>${accionHtml}</td>
                    `;
                    tbodyExamenes.appendChild(tr);
                });
            }
        }

        window.removeAlergia = (index) => { t_alergias_array.splice(index, 1); renderArrays(); };
        window.removeCondicion = (index) => { t_condiciones_array.splice(index, 1); renderArrays(); };
        window.removeExamen = (index) => { t_examenes_array.splice(index, 1); renderArrays(); };

        document.getElementById('btnAddAlergia').addEventListener('click', () => {
            const input = document.getElementById('t_alergia_input');
            if(input.value.trim() !== '') {
                t_alergias_array.push(input.value.trim());
                input.value = '';
                renderArrays();
            }
        });

        document.getElementById('btnAddCondicion').addEventListener('click', () => {
            const input = document.getElementById('t_condicion_input');
            if(input.value.trim() !== '') {
                t_condiciones_array.push(input.value.trim());
                input.value = '';
                renderArrays();
            }
        });

        document.getElementById('btnAddExamen').addEventListener('click', () => {
            const tipo = document.getElementById('t_examen_tipo').value;
            const realizacion = document.getElementById('t_examen_realizacion').value;
            const vencimiento = document.getElementById('t_examen_vencimiento').value;

            if(!realizacion || !vencimiento) {
                showToast('Debes ingresar ambas fechas para el examen', 'error');
                return;
            }
            if(new Date(vencimiento) <= new Date(realizacion)) {
                showToast('La fecha de vencimiento debe ser mayor a la de realización', 'error');
                return;
            }

            t_examenes_array.push({
                id: null,
                tipo,
                realizacion,
                vencimiento,
                origen_ui: 'nuevo'
            });
            document.getElementById('t_examen_realizacion').value = '';
            document.getElementById('t_examen_vencimiento').value = '';
            renderArrays();
        });

        // --- VISUALIZACIÓN Y SEMÁFORO (VISTA B) ---
        function evaluarSemaforoMedico(examenes) {
            if (!examenes || examenes.length === 0) return { color: 'gray', texto: '⚪ Sin Registro' };

            // Agrupar por tipo de examen para encontrar el más reciente de cada uno
            const ultimosExamenes = {};
            examenes.forEach(ex => {
                if (!ultimosExamenes[ex.tipo] || new Date(ex.vencimiento) > new Date(ultimosExamenes[ex.tipo].vencimiento)) {
                    ultimosExamenes[ex.tipo] = ex;
                }
            });

            let estado = 'verde';
            const hoy = new Date();
            const limite30Dias = new Date(hoy);
            limite30Dias.setDate(limite30Dias.getDate() + 30);

            for (const tipo in ultimosExamenes) {
                const fechaVencimiento = new Date(ultimosExamenes[tipo].vencimiento);
                if (fechaVencimiento < hoy) {
                    estado = 'rojo';
                    break; // Un examen vencido ya marca todo en rojo
                } else if (fechaVencimiento <= limite30Dias) {
                    estado = 'amarillo'; // Un examen por vencer marca en amarillo, pero seguimos buscando por si hay un rojo
                }
            }

            if (estado === 'rojo') return { color: 'danger', texto: '🔴 Vencido' };
            if (estado === 'amarillo') return { color: 'warning', texto: '🟡 Por Vencer' };
            return { color: 'success', texto: '🟢 Vigente' };
        }

        let cacheTrabajadores = {}; // Para acceso rápido al editar/ver perfil

        // SVG Placeholder por defecto para perfiles sin foto (reemplaza a via.placeholder.com que fallaba)
        const defaultProfileSVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%239ca3af"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;

        // Variables para filtrado
        let filtrosTrabajadores = { busqueda: '', departamento: '', estadoLaboral: '', estadoMedico: '', aptitudOcupacional: '', archivo: 'activos' };
        let departamentosDisponiblesFiltro = [];

        const opcionesFiltroTrabajadores = {
            estadoLaboral: [
                { value: '', label: 'Todos los estados laborales' },
                { value: 'Activo', label: 'Activo' },
                { value: 'Inactivo', label: 'Inactivo' },
                { value: 'Retirado', label: 'Retirado' },
                { value: 'No definido', label: 'No definido' }
            ],
            estadoMedico: [
                { value: '', label: 'Todos los estados médicos' },
                { value: 'success', label: '🟢 Vigente' },
                { value: 'warning', label: '🟡 Por vencer' },
                { value: 'danger', label: '🔴 Vencido' },
                { value: 'gray', label: '⚪ Sin registro' }
            ],
            aptitudOcupacional: [
                { value: '', label: 'Todas las aptitudes' },
                { value: 'Apto', label: 'Apto' },
                { value: 'Apto con restricciones', label: 'Apto con restricciones' },
                { value: 'No apto temporalmente', label: 'No apto temporalmente' },
                { value: 'Pendiente de evaluación', label: 'Pendiente de evaluación' }
            ],
            archivo: [
                { value: 'activos', label: 'Expedientes activos' },
                { value: 'archivados', label: 'Expedientes archivados' },
                { value: 'todos', label: 'Todos los expedientes' }
            ]
        };

        function obtenerOpcionesFiltroTrabajadores(tipoFiltro) {
            if (tipoFiltro === 'departamento') {
                return [
                    { value: '', label: 'Todas las áreas' },
                    ...departamentosDisponiblesFiltro.map(nombre => ({ value: nombre, label: nombre }))
                ];
            }

            return opcionesFiltroTrabajadores[tipoFiltro] || [];
        }

        function restablecerFiltrosDirectorio() {
            filtrosTrabajadores.departamento = '';
            filtrosTrabajadores.estadoLaboral = '';
            filtrosTrabajadores.estadoMedico = '';
            filtrosTrabajadores.aptitudOcupacional = '';
            // Los expedientes archivados permanecen fuera del directorio salvo que se elija ese filtro.
            filtrosTrabajadores.archivo = 'activos';
        }

        function actualizarOpcionesFiltroValor() {
            const tipoFiltro = document.getElementById('filterTipo').value;
            const selectValor = document.getElementById('filterValor');
            const opciones = obtenerOpcionesFiltroTrabajadores(tipoFiltro);

            selectValor.innerHTML = '';
            opciones.forEach(({ value, label }) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                selectValor.appendChild(option);
            });

            selectValor.value = tipoFiltro === 'archivo' ? 'activos' : '';
        }

        function aplicarFiltroDirectorioSeleccionado() {
            const tipoFiltro = document.getElementById('filterTipo').value;
            const valorFiltro = document.getElementById('filterValor').value;

            restablecerFiltrosDirectorio();
            filtrosTrabajadores[tipoFiltro] = valorFiltro;
            renderizarTarjetasTrabajadores();
        }

        function renderizarTarjetasTrabajadores() {
            const grid = document.getElementById('trabajadoresGrid');
            grid.innerHTML = '';

            const trabajadoresArray = Object.values(cacheTrabajadores);

            if (trabajadoresArray.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6b7280;">No hay miembros registrados.</div>';
                return;
            }

            // Aplicar filtros
            const filtrados = trabajadoresArray.filter(t => {
                const examenes = obtenerExamenesTrabajador(t);
                const semaforo = evaluarSemaforoMedico(examenes);
                const nombreCompleto = `${t.nombres} ${t.apellidos}`.toLowerCase();

                const cumpleBusqueda = filtrosTrabajadores.busqueda === '' ||
                                     nombreCompleto.includes(filtrosTrabajadores.busqueda) ||
                                     (t.dni && t.dni.includes(filtrosTrabajadores.busqueda));

                const cumpleDepto = filtrosTrabajadores.departamento === '' ||
                                  t.departamento === filtrosTrabajadores.departamento;

                const estadoLaboralT = t.estado_laboral || 'No definido';
                const cumpleEstadoLaboral = filtrosTrabajadores.estadoLaboral === '' ||
                                   estadoLaboralT === filtrosTrabajadores.estadoLaboral;

                const cumpleEstadoMedico = filtrosTrabajadores.estadoMedico === '' ||
                                   semaforo.color === filtrosTrabajadores.estadoMedico;

                const aptitud = t.aptitud_ocupacional || 'Pendiente de evaluación';
                const cumpleAptitud = filtrosTrabajadores.aptitudOcupacional === '' ||
                                    aptitud === filtrosTrabajadores.aptitudOcupacional;

                const estaArchivado = t.archivado === true;
                let cumpleArchivo = true;
                if (filtrosTrabajadores.archivo === 'activos') {
                    cumpleArchivo = !estaArchivado;
                } else if (filtrosTrabajadores.archivo === 'archivados') {
                    cumpleArchivo = estaArchivado;
                }

                return cumpleBusqueda && cumpleDepto && cumpleEstadoLaboral && cumpleEstadoMedico && cumpleAptitud && cumpleArchivo;
            });

            if (filtrados.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6b7280;">No se encontraron resultados que coincidan con los filtros.</div>';
                return;
            }

            filtrados.forEach((t) => {
                const examenes = obtenerExamenesTrabajador(t);
                const semaforo = evaluarSemaforoMedico(examenes);
                const fotoHtml = t.fotografia_url ?
                    `<img src="${escapeHtml(urlImagenSegura(t.fotografia_url))}" alt="Foto de ${escapeHtml(t.nombres)}">` :
                    `<div class="avatar-placeholder">👤</div>`;

                const estadoLaboralT = t.estado_laboral || 'No definido';
                let colorEstadoLaboral = 'badge-gray';
                if (estadoLaboralT === 'Activo') colorEstadoLaboral = 'badge-success';
                else if (estadoLaboralT === 'Retirado') colorEstadoLaboral = 'badge-info';

                const aptitudOcupacional = t.aptitud_ocupacional || 'Pendiente de evaluación';
                let colorAptitudOcupacional = 'badge-gray';
                if (aptitudOcupacional === 'Apto') colorAptitudOcupacional = 'badge-success';
                else if (aptitudOcupacional === 'Apto con restricciones') colorAptitudOcupacional = 'badge-warning';
                else if (aptitudOcupacional === 'No apto temporalmente') colorAptitudOcupacional = 'badge-danger';


                const estaArchivado = t.archivado === true;

                let actionButtonHtml = '';
                let badgeArchivado = '';

                if (estaArchivado) {
                    badgeArchivado = `
                        <div class="worker-archive-badge">
                            <span class="badge badge-info">📦 Archivado</span>
                        </div>
                    `;
                    actionButtonHtml = `
                        <button class="options-btn btn-restaurar-trabajador" data-id="${escapeHtml(t.id)}" title="Restaurar expediente" aria-label="Restaurar expediente de ${escapeHtml(t.nombres)} ${escapeHtml(t.apellidos)}">
                            <span class="material-symbols-outlined" aria-hidden="true">restore_from_trash</span>
                        </button>
                    `;
                } else {
                    actionButtonHtml = `
                        <button class="options-btn btn-archivar-trabajador" data-id="${escapeHtml(t.id)}" title="Archivar expediente" aria-label="Archivar expediente de ${escapeHtml(t.nombres)} ${escapeHtml(t.apellidos)}">
                            <span class="material-symbols-outlined" aria-hidden="true">archive</span>
                        </button>
                    `;
                }

                const card = document.createElement('div');
                card.className = 'worker-card';
                card.innerHTML = `
                    <div class="worker-card-header">
                        <div class="worker-card-identity">
                            ${fotoHtml}
                            <div class="worker-card-identity-copy">
                                <h3>${escapeHtml(t.nombres)} ${escapeHtml(t.apellidos)}</h3>
                                <div class="role">${escapeHtml(t.puesto_trabajo)}</div>
                                <div class="dept">
                                    <span class="material-symbols-outlined" aria-hidden="true">apartment</span>
                                    ${escapeHtml(t.departamento)}
                                </div>
                            </div>
                        </div>
                        <div class="worker-card-actions">
                            ${badgeArchivado}
                            ${actionButtonHtml}
                        </div>
                    </div>

                    <div class="worker-card-body">
                        <div class="worker-status-group">
                            <div class="worker-status-row">
                                <span class="status-label">Estado laboral</span>
                                <span class="badge ${colorEstadoLaboral}">${escapeHtml(estadoLaboralT)}</span>
                            </div>
                            <div class="worker-status-row">
                                <span class="status-label">Vigilancia médica</span>
                                <span class="badge badge-${semaforo.color}">${escapeHtml(semaforo.texto)}</span>
                            </div>
                            <div class="worker-status-row">
                                <span class="status-label">Aptitud ocupacional</span>
                                <span class="badge ${colorAptitudOcupacional}">${escapeHtml(aptitudOcupacional)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="worker-card-footer">
                        <button class="btn-profile btn-ver-perfil" data-id="${escapeHtml(t.id)}">
                            <span class="material-symbols-outlined" aria-hidden="true">person</span>
                            Ver perfil completo
                        </button>
                        <button class="btn-history btn-ver-historial" data-id="${escapeHtml(t.id)}">
                            <span class="material-symbols-outlined" aria-hidden="true">history</span>
                            Ver historial
                        </button>
                    </div>
                `;
                grid.appendChild(card);
            });

            // Asignar eventos
            document.querySelectorAll('.btn-ver-perfil').forEach(btn => {
                btn.addEventListener('click', (e) => abrirDossierMedico(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-ver-historial').forEach(btn => {
                btn.addEventListener('click', (e) => abrirHistorialOcupacional(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-archivar-trabajador').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    abrirModalArchivarTrabajador(id);
                });
            });

            document.querySelectorAll('.btn-restaurar-trabajador').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    if(confirm('¿Desea restaurar este expediente al directorio activo?')) {
                        await restaurarTrabajador(id);
                    }
                });
            });
        }

        // Escuchar cambios en los filtros
        document.getElementById('searchTrabajador').addEventListener('input', (e) => {
            filtrosTrabajadores.busqueda = e.target.value.toLowerCase();
            renderizarTarjetasTrabajadores();
        });

        document.getElementById('filterTipo').addEventListener('change', () => {
            actualizarOpcionesFiltroValor();
            aplicarFiltroDirectorioSeleccionado();
        });

        document.getElementById('filterValor').addEventListener('change', aplicarFiltroDirectorioSeleccionado);
        actualizarOpcionesFiltroValor();

        // Actualizar el select de filtros de departamento cuando se carga la página o cambian las áreas
        async function actualizarSelectFiltroDepartamentos() {
            try {
                const snapshot = await getDocs(coleccionAreas);
                departamentosDisponiblesFiltro = snapshot.docs
                    .map(docSnap => docSnap.data().nombre)
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

                if (document.getElementById('filterTipo').value === 'departamento') {
                    const valorActual = document.getElementById('filterValor').value;
                    actualizarOpcionesFiltroValor();

                    if (departamentosDisponiblesFiltro.includes(valorActual)) {
                        document.getElementById('filterValor').value = valorActual;
                    }
                }
            } catch (error) {
                console.error("Error al cargar áreas para el filtro:", error);
            }
        }


        let trabajadoresCargados = false;
        let examenesCargados = false;
        let saludClinicaCargada = false;
        let aptitudesCargadas = false;

        function renderizarTrabajadoresSiListo() {
            if (trabajadoresCargados && examenesCargados && saludClinicaCargada && aptitudesCargadas) {
                reconstruirCacheTrabajadores();
                renderizarTarjetasTrabajadores();
            }
        }

        function iniciarSuscripcionTrabajadores() {
            if (!currentUser) return;

            actualizarSelectFiltroDepartamentos();

            unsubscribeTrabajadores = onSnapshot(coleccionTrabajadores, (snapshot) => {
                cacheTrabajadoresBase = {};

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const id = docSnap.id;
                    cacheTrabajadoresBase[id] = { ...data, id };
                });

                trabajadoresCargados = true;
                renderizarTrabajadoresSiListo();
                actualizarOpcionesIncidentes();

            }, (error) => {
                console.error("Error al cargar trabajadores:", error);
            });
        }

        function iniciarSuscripcionExamenesMedicos() {
            if (!currentUser) return;

            unsubscribeExamenesMedicos = onSnapshot(coleccionExamenesMedicos, (snapshot) => {
                cacheExamenesPorTrabajador = {};

                snapshot.forEach(docSnap => {
                    const examen = {
                        id: docSnap.id,
                        ...docSnap.data()
                    };

                    const trabajadorId = examen.trabajador_id;
                    if (!cacheExamenesPorTrabajador[trabajadorId]) {
                        cacheExamenesPorTrabajador[trabajadorId] = [];
                    }
                    cacheExamenesPorTrabajador[trabajadorId].push(examen);
                });

                examenesCargados = true;
                renderizarTrabajadoresSiListo();

            }, (error) => {
                console.error("Error al cargar examenes medicos:", error);
            });
        }

        function iniciarSuscripcionSaludClinica() {
            if (!currentUser || !esMedicoOcupacional()) return;

            unsubscribeSaludClinica = onSnapshot(coleccionSaludClinica, (snapshot) => {
                cacheSaludClinica = {};
                snapshot.forEach(docSnap => {
                    cacheSaludClinica[docSnap.id] = docSnap.data();
                });
                saludClinicaCargada = true;
                renderizarTrabajadoresSiListo();
            }, (error) => {
                console.error("Error al cargar información clínica:", error);
            });
        }

        function iniciarSuscripcionAptitudesOcupacionales() {
            if (!currentUser) return;

            unsubscribeAptitudesOcupacionales = onSnapshot(coleccionAptitudesOcupacionales, (snapshot) => {
                cacheAptitudesOcupacionales = {};
                snapshot.forEach(docSnap => {
                    cacheAptitudesOcupacionales[docSnap.id] = docSnap.data();
                });
                aptitudesCargadas = true;
                renderizarTrabajadoresSiListo();
            }, (error) => {
                console.error("Error al cargar aptitudes ocupacionales:", error);
            });
        }

        // --- VISTA C: DOSSIER MÉDICO ---
// --- FUNCIONES HISTORIAL OCUPACIONAL ---

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
                                    Área: ${escapeHtml(evento.detalle.departamento || '-')} / Puesto: ${escapeHtml(evento.detalle.puesto_trabajo || '-')}<br>
                                    Estado: ${escapeHtml(evento.detalle.estado_laboral || '-')}<br>
                                    Aptitud: ${escapeHtml(evento.detalle.aptitud_ocupacional || '-')}
                                </div>`;
                            }
                            break;
                        case 'CAMBIO_AREA_PUESTO':
                            icon = '🏢';
                            const dArea = evento.detalle.area_anterior !== evento.detalle.area_nueva;
                            const dPuesto = evento.detalle.puesto_anterior !== evento.detalle.puesto_nuevo;

                            if (dArea && dPuesto) {
                                descriptionHtml = `Área: ${escapeHtml(evento.detalle.area_anterior)} → <strong>${escapeHtml(evento.detalle.area_nueva)}</strong><br>Puesto: ${escapeHtml(evento.detalle.puesto_anterior)} → <strong>${escapeHtml(evento.detalle.puesto_nuevo)}</strong>`;
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
                            descriptionHtml = `Estado laboral: ${escapeHtml(evento.detalle.anterior)} → <strong>${escapeHtml(evento.detalle.nuevo)}</strong>`;
                            break;
                        case 'APTITUD_OCUPACIONAL':
                            icon = '🩺';
                            descriptionHtml = `Aptitud: ${escapeHtml(evento.detalle.aptitud_anterior || '-')} → <strong>${escapeHtml(evento.detalle.aptitud_nueva || '-')}</strong>`;
                            if (evento.detalle.restricciones) {
                                descriptionHtml += `<div class="timeline-detail">Restricciones: ${escapeHtml(evento.detalle.restricciones)}</div>`;
                            }
                            break;
                        case 'ARCHIVADO_EXPEDIENTE':
                            icon = '📦';
                            descriptionHtml = `Expediente archivado.<div class="timeline-detail">Motivo: ${escapeHtml(evento.detalle.motivo || '-')}</div>`;
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
                                    <div class="timeline-title">${escapeHtml(evento.titulo || 'Evento Ocupacional')}</div>
                                    <div class="timeline-date">${escapeHtml(formatFecha(evento.fecha_evento))}</div>
                                </div>
                                <div class="timeline-detail">
                                    ${descriptionHtml}
                                </div>
                                <div class="timeline-user">
                                    <span>Registrado por: ${escapeHtml(evento.usuario_nombre || 'Usuario')} ${evento.usuario_rol ? `(${escapeHtml(evento.usuario_rol)})` : ''}</span>
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

        function abrirDossierMedico(id) {
            const t = cacheTrabajadores[id];
            if(!t) return;

            document.getElementById('vista-b-trabajadores').style.display = 'none';
            document.getElementById('vista-a-registro').style.display = 'none';
            document.getElementById('vista-c-perfil').style.display = 'block';

            // Popular datos de cabecera
            const imgEl = document.getElementById('p_foto');
            const placeholderEl = document.getElementById('p_foto_placeholder');
            if(t.fotografia_url) {
                imgEl.src = t.fotografia_url;
                imgEl.style.display = 'block';
                if(placeholderEl) placeholderEl.style.display = 'none';
            } else {
                imgEl.style.display = 'none';
                if(placeholderEl) placeholderEl.style.display = 'block';
            }

            document.getElementById('p_nombre_completo').textContent = `${t.nombres} ${t.apellidos}`;
            document.getElementById('p_puesto_departamento').textContent = `${t.puesto_trabajo} | ${t.departamento}`;
            document.getElementById('p_dni').textContent = t.dni;

            const edad = new Date().getFullYear() - new Date(t.fecha_nacimiento).getFullYear();
            document.getElementById('p_edad').textContent = `${edad} años`;
            document.getElementById('p_tipo_sangre').textContent = t.tipo_sangre || 'No reg.';

            // Estados en el perfil
            const estadoLaboralT = t.estado_laboral || 'No definido';
            let colorEstadoLaboral = 'badge-gray';
            if (estadoLaboralT === 'Activo') colorEstadoLaboral = 'badge-success';
            else if (estadoLaboralT === 'Retirado') colorEstadoLaboral = 'badge-info';

            const examenes = obtenerExamenesTrabajador(t);
            const semaforo = evaluarSemaforoMedico(examenes);

            document.getElementById('p_estado_laboral').innerHTML = `<span class="badge ${colorEstadoLaboral}">${escapeHtml(estadoLaboralT)}</span>`;
            document.getElementById('p_estado_vigilancia_medica').innerHTML = `<span class="badge badge-${semaforo.color}">${escapeHtml(semaforo.texto)}</span>`;

            // Tarjetas medias
            document.getElementById('p_alergias').textContent = t.alergias && t.alergias.length > 0 ? t.alergias.join(', ') : 'Ninguna';
            document.getElementById('p_condiciones').textContent = t.condiciones_medicas && t.condiciones_medicas.length > 0 ? t.condiciones_medicas.join(', ') : 'Ninguna';
            document.getElementById('p_emergencia_nombre').textContent = t.emergencia_contacto_nombre || 'No registrado';
            document.getElementById('p_emergencia_parentesco').textContent = t.emergencia_contacto_parentesco || '-';
            document.getElementById('p_emergencia_telefono').textContent = t.emergencia_contacto_telefono || '-';

            // EPP
            document.getElementById('p_talla_ropa').textContent = t.talla_ropa || '-';
            document.getElementById('p_talla_calzado').textContent = t.talla_calzado || '-';

            // Historial de Exámenes
            const tbody = document.getElementById('p_examenes_table');
            tbody.innerHTML = '';
            if(!examenes || examenes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin registro de exámenes</td></tr>';
            } else {
                // Ordenar por fecha de realización descendente
                const examenesOrdenados = [...examenes].sort((a,b) => new Date(b.realizacion) - new Date(a.realizacion));
                const hoy = new Date();

                examenesOrdenados.forEach(ex => {
                    const fVence = new Date(ex.vencimiento);
                    let badge = '';
                    if (fVence < hoy) badge = '<span class="badge badge-danger">Vencido</span>';
                    else {
                        const limite = new Date(hoy);
                        limite.setDate(limite.getDate() + 30);
                        if (fVence <= limite) badge = '<span class="badge badge-warning">Por Vencer</span>';
                        else badge = '<span class="badge badge-success">Vigente</span>';
                    }

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${escapeHtml(ex.tipo)}</td>
                        <td>${escapeHtml(ex.realizacion)}</td>
                        <td>${escapeHtml(ex.vencimiento)}</td>
                        <td>${badge}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // Aptitud Ocupacional
            const aptitudOcupacional = t.aptitud_ocupacional || 'Pendiente de evaluación';
            let colorAptitud = 'badge-gray';
            if (aptitudOcupacional === 'Apto') colorAptitud = 'badge-success';
            else if (aptitudOcupacional === 'Apto con restricciones') colorAptitud = 'badge-warning';
            else if (aptitudOcupacional === 'No apto temporalmente') colorAptitud = 'badge-danger';

            document.getElementById('p_aptitud_ocupacional').innerHTML = `<span class="badge ${colorAptitud}">${escapeHtml(aptitudOcupacional)}</span>`;
            document.getElementById('p_aptitud_fecha').textContent = t.aptitud_fecha || '-';
            document.getElementById('p_aptitud_vigencia').textContent = t.aptitud_vigencia || '-';
            document.getElementById('p_aptitud_observaciones').textContent = t.aptitud_observaciones || '-';

            const pRestricciones = document.getElementById('p_aptitud_restricciones');
            const containerRestricciones = document.getElementById('container_p_aptitud_restricciones');

            if (aptitudOcupacional === 'Apto con restricciones') {
                containerRestricciones.style.display = '';
                pRestricciones.textContent = t.aptitud_restricciones || 'No aplica';
            } else {
                containerRestricciones.style.display = 'none';
            }

            // Configurar botón de edición
            document.getElementById('btnEditarPerfil').onclick = () => editarTrabajador(id);
        }

        // --- ARCHIVAR TRABAJADOR ---
        let trabajadorAArchivarId = null;
        function abrirModalArchivarTrabajador(id) {
            const t = cacheTrabajadores[id];
            if (!t) return;
            trabajadorAArchivarId = id;
            document.getElementById('archivarTrabajadorNombre').textContent = `${t.nombres} ${t.apellidos}`;
            document.getElementById('motivoArchivadoTrabajador').value = '';
            document.getElementById('modalArchivarTrabajador').classList.add('show');
        }

        document.getElementById('btnConfirmarArchivarTrabajador').addEventListener('click', async () => {
            if (!trabajadorAArchivarId) return;
            const motivo = document.getElementById('motivoArchivadoTrabajador').value.trim();
            if (motivo.length < 5) {
                showToast('Ingrese un motivo válido para archivar el expediente.', 'error');
                return;
            }

            try {
                const btn = document.getElementById('btnConfirmarArchivarTrabajador');
                btn.disabled = true;
                btn.textContent = 'Archivando...';

                const batch = writeBatch(db);
                const trabajadorRef = doc(db, 'artifacts', appId, 'public', 'data', 'trabajadores', trabajadorAArchivarId);
                const oldT = cacheTrabajadores[trabajadorAArchivarId] || {};

                batch.update(trabajadorRef, {
                    archivado: true,
                    fecha_archivado: new Date().toISOString(),
                    motivo_archivado: motivo,
                    archivado_por_uid: currentUser.uid,
                    archivado_por_nombre: currentUserProfile?.nombre || 'Usuario'
                });

                const eventoArchivado = crearDatosEventoHistorial('ARCHIVADO_EXPEDIENTE', 'Expediente Archivado', {
                    motivo: motivo,
                    estado_laboral: oldT.estado_laboral || 'No definido'
                });

                const eventoRef = doc(collection(trabajadorRef, 'historial_ocupacional'));
                batch.set(eventoRef, eventoArchivado);

                await batch.commit();

                showToast('✅ Expediente archivado correctamente');
                document.getElementById('modalArchivarTrabajador').classList.remove('show');
                trabajadorAArchivarId = null;
                btn.disabled = false;
                btn.textContent = 'Archivar expediente';
            } catch (error) {
                console.error("Error al archivar:", error);
                showToast('No fue posible archivar el expediente.', 'error');
                const btn = document.getElementById('btnConfirmarArchivarTrabajador');
                btn.disabled = false;
                btn.textContent = 'Archivar expediente';
            }
        });

        // --- RESTAURAR TRABAJADOR ---
        async function restaurarTrabajador(id) {
            try {
                const batch = writeBatch(db);
                const trabajadorRef = doc(db, 'artifacts', appId, 'public', 'data', 'trabajadores', id);

                batch.update(trabajadorRef, {
                    archivado: false,
                    fecha_restauracion: new Date().toISOString(),
                    restaurado_por_uid: currentUser.uid,
                    restaurado_por_nombre: currentUserProfile?.nombre || 'Usuario'
                });

                const eventoRestauracion = crearDatosEventoHistorial('RESTAURACION_EXPEDIENTE', 'Expediente Restaurado');
                const eventoRef = doc(collection(trabajadorRef, 'historial_ocupacional'));
                batch.set(eventoRef, eventoRestauracion);

                await batch.commit();

                showToast('✅ Expediente restaurado correctamente');
            } catch (error) {
                console.error("Error al restaurar:", error);
                showToast('No fue posible restaurar el expediente.', 'error');
            }
        }


        // --- EDITAR TRABAJADOR ---
        async function editarTrabajador(id) {
            const t = cacheTrabajadores[id];
            if(!t) return;

            if (t.archivado === true) {
                showToast('Debe restaurar el expediente antes de editarlo.', 'error');
                return;
            }

            document.getElementById('vista-b-trabajadores').style.display = 'none';
            document.getElementById('vista-c-perfil').style.display = 'none';
            document.getElementById('vista-a-registro').style.display = 'block';
            document.getElementById('vista-a-titulo').textContent = '✏️ Editar Trabajador';

            document.getElementById('t_id').value = id;
            document.getElementById('t_nombres').value = t.nombres;
            document.getElementById('t_apellidos').value = t.apellidos;
            document.getElementById('t_dni').value = t.dni;
            document.getElementById('t_fecha_nacimiento').value = t.fecha_nacimiento;
            document.getElementById('t_puesto').value = t.puesto_trabajo;
            document.getElementById('t_estado_laboral').value = t.estado_laboral || '';
            document.getElementById('t_tipo_sangre').value = t.tipo_sangre || '';
            document.getElementById('t_emergencia_nombre').value = t.emergencia_contacto_nombre || '';
            document.getElementById('t_emergencia_parentesco').value = t.emergencia_contacto_parentesco || '';
            document.getElementById('t_emergencia_telefono').value = t.emergencia_contacto_telefono || '';
            document.getElementById('t_talla_ropa').value = t.talla_ropa || '';
            document.getElementById('t_talla_calzado').value = t.talla_calzado || '';

            document.getElementById('t_aptitud_ocupacional').value = t.aptitud_ocupacional || 'Pendiente de evaluación';
            document.getElementById('t_aptitud_fecha').value = t.aptitud_fecha || '';
            document.getElementById('t_aptitud_vigencia').value = t.aptitud_vigencia || '';
            document.getElementById('t_aptitud_observaciones').value = t.aptitud_observaciones || '';
            document.getElementById('t_aptitud_restricciones').value = t.aptitud_restricciones || '';
            actualizarCamposAptitud();

            await poblarSelectAreas();
            document.getElementById('t_departamento').value = t.departamento;

            t_alergias_array = t.alergias ? [...t.alergias] : [];
            t_condiciones_array = t.condiciones_medicas ? [...t.condiciones_medicas] : [];
            t_examenes_array = obtenerExamenesTrabajador(t).map(ex => ({
                ...ex,
                origen_ui: 'persistido'
            }));

            renderArrays();

            // Enable all tabs when editing, as we assume it's already filled
            document.querySelectorAll('.wizard-step-btn').forEach(btn => {
                btn.disabled = false;
            });

            aplicarPermisosSalud();
            mostrarPasoWizard(1);
        }

        // --- PROCESAR IMAGEN A BASE64 ---
        function resizeAndConvertToBase64(file, maxWidth = 300, maxHeight = 300) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > maxWidth) {
                                height *= maxWidth / width;
                                width = maxWidth;
                            }
                        } else {
                            if (height > maxHeight) {
                                width *= maxHeight / height;
                                height = maxHeight;
                            }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality jpeg
                        resolve(dataUrl);
                    };
                    img.onerror = (error) => reject(error);
                };
                reader.onerror = (error) => reject(error);
            });
        }

        // --- GUARDAR TRABAJADOR ---
        document.getElementById('formTrabajador').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSubmitTrabajador');
            btn.disabled = true;
            btn.textContent = '⏳ Guardando...';

            const id = document.getElementById('t_id').value;
            const dni = document.getElementById('t_dni').value;

            const aptitudOcupacional = document.getElementById('t_aptitud_ocupacional').value;
            const aptitudFecha = document.getElementById('t_aptitud_fecha').value;
            const aptitudVigencia = document.getElementById('t_aptitud_vigencia').value;
            const aptitudRestricciones = document.getElementById('t_aptitud_restricciones').value;
            const aptitudObservaciones = document.getElementById('t_aptitud_observaciones').value;

            // Validaciones Aptitud Ocupacional
            if (aptitudOcupacional !== 'Pendiente de evaluación' && !aptitudFecha) {
                showToast('Ingrese la fecha de evaluación de la aptitud ocupacional.', 'error');
                btn.disabled = false;
                btn.textContent = '✅ Guardar Trabajador';
                return;
            }

            if (aptitudFecha && aptitudVigencia) {
                if (new Date(aptitudVigencia) < new Date(aptitudFecha)) {
                    showToast('La fecha de vigencia de la aptitud no puede ser anterior a la fecha de evaluación.', 'error');
                    btn.disabled = false;
                    btn.textContent = '✅ Guardar Trabajador';
                    return;
                }
            }

            if (aptitudOcupacional === 'Apto con restricciones' && aptitudRestricciones.trim() === '') {
                showToast('Debe especificar las restricciones laborales aplicables.', 'error');
                btn.disabled = false;
                btn.textContent = '✅ Guardar Trabajador';
                return;
            }

            try {
                // Validación DNI Único
                if (!id) {
                    const q = query(coleccionTrabajadores, where("dni", "==", dni));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        showToast('El DNI ingresado ya está registrado', 'error');
                        btn.disabled = false;
                        btn.textContent = '✅ Guardar Trabajador';
                        return;
                    }
                } else {
                    // si se está editando, validar que si existe, sea de otro documento
                     const q = query(coleccionTrabajadores, where("dni", "==", dni));
                     const querySnapshot = await getDocs(q);
                     let dniEnUso = false;
                     querySnapshot.forEach((docSnap) => {
                         if(docSnap.id !== id) dniEnUso = true;
                     });
                     if (dniEnUso) {
                        showToast('El DNI ingresado ya está registrado por otro trabajador', 'error');
                        btn.disabled = false;
                        btn.textContent = '✅ Guardar Trabajador';
                        return;
                     }
                }

                let fotoUrl = null;
                const fotoInput = document.getElementById('t_foto');
                if (fotoInput.files.length > 0) {
                    const file = fotoInput.files[0];
                    document.getElementById('t_foto_info').textContent = "Procesando imagen...";
                    try {
                        fotoUrl = await resizeAndConvertToBase64(file);
                        document.getElementById('t_foto_info').textContent = "Imagen procesada ✅";
                    } catch (err) {
                        console.error("Error al procesar la imagen:", err);
                        showToast('Error al procesar la imagen.', 'error');
                        document.getElementById('t_foto_info').textContent = "Error al procesar ❌";
                        btn.disabled = false;
                        btn.textContent = '✅ Guardar Trabajador';
                        return;
                    }
                }

                const estadoLaboralVal = document.getElementById('t_estado_laboral').value;
                if (!['Activo', 'Inactivo', 'Retirado'].includes(estadoLaboralVal)) {
                    showToast('Seleccione un estado laboral válido.', 'error');
                    btn.disabled = false;
                    btn.textContent = '✅ Guardar Trabajador';
                    return;
                }

                const trabajadorData = {
                    nombres: document.getElementById('t_nombres').value,
                    apellidos: document.getElementById('t_apellidos').value,
                    dni: dni,
                    fecha_nacimiento: document.getElementById('t_fecha_nacimiento').value,
                    departamento: document.getElementById('t_departamento').value,
                    puesto_trabajo: document.getElementById('t_puesto').value,
                    estado_laboral: estadoLaboralVal,
                    talla_ropa: document.getElementById('t_talla_ropa').value,
                    talla_calzado: document.getElementById('t_talla_calzado').value,
                    fechaActualizacion: new Date().toISOString()
                };

                const saludClinicaData = {
                    trabajador_id: id || null,
                    tipo_sangre: document.getElementById('t_tipo_sangre').value,
                    alergias: t_alergias_array,
                    condiciones_medicas: t_condiciones_array,
                    emergencia_contacto_nombre: document.getElementById('t_emergencia_nombre').value,
                    emergencia_contacto_parentesco: document.getElementById('t_emergencia_parentesco').value,
                    emergencia_contacto_telefono: document.getElementById('t_emergencia_telefono').value,
                    fechaActualizacion: serverTimestamp(),
                    actualizado_por_uid: currentUser?.uid || null
                };

                const aptitudData = {
                    trabajador_id: id || null,
                    aptitud_ocupacional: aptitudOcupacional,
                    aptitud_fecha: aptitudFecha,
                    aptitud_vigencia: aptitudVigencia,
                    aptitud_restricciones: aptitudOcupacional === 'Apto con restricciones' ? aptitudRestricciones : '',
                    aptitud_observaciones: aptitudObservaciones,
                    fechaActualizacion: serverTimestamp(),
                    actualizado_por_uid: currentUser?.uid || null
                };

                if(fotoUrl) trabajadorData.fotografia_url = fotoUrl;

                const batch = writeBatch(db);

                const examenesNuevos = t_examenes_array.filter(ex => ex.origen_ui === 'nuevo');

                if (id) {
                    // Editar existente
                    const trabajadorRef = doc(db, 'artifacts', appId, 'public', 'data', 'trabajadores', id);
                    const historialRefBase = collection(trabajadorRef, 'historial_ocupacional');
                    const saludClinicaRef = doc(coleccionSaludClinica, id);
                    const aptitudRef = doc(coleccionAptitudesOcupacionales, id);
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
                        oldT.aptitud_ocupacional !== aptitudData.aptitud_ocupacional ||
                        oldT.aptitud_fecha !== aptitudData.aptitud_fecha ||
                        oldT.aptitud_vigencia !== aptitudData.aptitud_vigencia ||
                        oldT.aptitud_restricciones !== aptitudData.aptitud_restricciones;

                    if (esMedicoOcupacional() && aptitudCambiada) {
                        const eventoAptitud = crearDatosEventoHistorial('APTITUD_OCUPACIONAL', 'Actualización de Aptitud Ocupacional', {
                            aptitud_anterior: oldT.aptitud_ocupacional || 'No definido',
                            aptitud_nueva: aptitudData.aptitud_ocupacional,
                            fecha_evaluacion: aptitudData.aptitud_fecha || null,
                            vigencia_hasta: aptitudData.aptitud_vigencia || null,
                            restricciones: aptitudData.aptitud_restricciones || null
                        });
                        batch.set(doc(historialRefBase), eventoAptitud);
                    }

                    batch.update(trabajadorRef, trabajadorData);

                    if (esMedicoOcupacional()) {
                        batch.set(saludClinicaRef, { ...saludClinicaData, trabajador_id: id }, { merge: true });
                        batch.set(aptitudRef, { ...aptitudData, trabajador_id: id }, { merge: true });
                    }

                    examenesNuevos.forEach(examen => {
                        const examenRef = doc(coleccionExamenesMedicos);
                        batch.set(examenRef, {
                            trabajador_id: trabajadorRef.id,
                            tipo: examen.tipo,
                            realizacion: examen.realizacion,
                            vencimiento: examen.vencimiento,
                            fecha_creacion: serverTimestamp(),
                            creado_por_uid: currentUser?.uid || null,
                            creado_por_nombre: currentUserProfile?.nombre || 'Usuario',
                            origen: 'registro'
                        });
                    });

                    await batch.commit();
                    showToast('✅ Trabajador actualizado exitosamente');
                } else {
                    // Crear nuevo
                    const trabajadorRef = doc(coleccionTrabajadores);
                    const saludClinicaRef = doc(coleccionSaludClinica, trabajadorRef.id);
                    const aptitudRef = doc(coleccionAptitudesOcupacionales, trabajadorRef.id);
                    trabajadorData.fechaCreacion = new Date().toISOString();
                    trabajadorData.archivado = false;
                    trabajadorData.examenes_version = 2;

                    const eventoCreacion = crearDatosEventoHistorial('CREACION_EXPEDIENTE', 'Expediente Creado', {
                        estado_laboral: trabajadorData.estado_laboral,
                        departamento: trabajadorData.departamento,
                        puesto_trabajo: trabajadorData.puesto_trabajo,
                        aptitud_ocupacional: esMedicoOcupacional()
                            ? aptitudData.aptitud_ocupacional
                            : 'Pendiente de evaluación'
                    });

                    const historialRefBase = collection(trabajadorRef, 'historial_ocupacional');

                    batch.set(trabajadorRef, trabajadorData);
                    batch.set(doc(historialRefBase), eventoCreacion);

                    if (esMedicoOcupacional()) {
                        batch.set(saludClinicaRef, { ...saludClinicaData, trabajador_id: trabajadorRef.id });
                        batch.set(aptitudRef, { ...aptitudData, trabajador_id: trabajadorRef.id });
                    }

                    examenesNuevos.forEach(examen => {
                        const examenRef = doc(coleccionExamenesMedicos);
                        batch.set(examenRef, {
                            trabajador_id: trabajadorRef.id,
                            tipo: examen.tipo,
                            realizacion: examen.realizacion,
                            vencimiento: examen.vencimiento,
                            fecha_creacion: serverTimestamp(),
                            creado_por_uid: currentUser?.uid || null,
                            creado_por_nombre: currentUserProfile?.nombre || 'Usuario',
                            origen: 'registro'
                        });
                    });

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


        // ============================================================
        // 6. MÓDULO DE INCIDENTES (REPORTE Y CONSULTA)
        // ============================================================
        const coleccionIncidentes = collection(db, 'artifacts', appId, 'public', 'data', 'incidentes');
        let cacheIncidentes = [];

        const OPCIONES_INCIDENTES = {
            estado: ['Reportado', 'En investigación', 'Acciones en curso', 'Cerrado'],
            tipo: ['Incidente', 'Accidente', 'Cuasi accidente'],
            gravedad: ['Baja', 'Media', 'Alta', 'Crítica']
        };

        function esGestorIncidentes() {
            return ['Administrador', 'Responsable H&S'].includes(currentUserProfile?.rol);
        }

        function fechaIncidente(valor, incluirHora = false) {
            if (!valor) return 'Sin fecha';
            const fecha = valor.toDate ? valor.toDate() : new Date(valor);
            if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
            return new Intl.DateTimeFormat('es-HN', {
                day: '2-digit', month: 'short', year: 'numeric',
                ...(incluirHora ? { hour: '2-digit', minute: '2-digit' } : {})
            }).format(fecha);
        }

        function claseEstadoIncidente(valor) {
            return `incident-badge-${String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '-')}`;
        }

        function actualizarOpcionesIncidentes() {
            const areaSelect = document.getElementById('incArea');
            if (areaSelect) {
                const actual = areaSelect.value;
                const areas = Object.values(cacheAreas).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
                areaSelect.innerHTML = '<option value="">Seleccione un área…</option>' + areas.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.nombre)}</option>`).join('');
                if (cacheAreas[actual]) areaSelect.value = actual;
            }

            const trabajadorSelect = document.getElementById('incTrabajador');
            if (trabajadorSelect) {
                const actual = trabajadorSelect.value;
                const trabajadores = Object.values(cacheTrabajadoresBase).filter(t => t.estado_laboral !== 'Archivado').sort((a, b) => `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`, 'es'));
                trabajadorSelect.innerHTML = '<option value="">Sin trabajador relacionado</option>' + trabajadores.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(`${t.nombres || ''} ${t.apellidos || ''}`.trim())}</option>`).join('');
                if (cacheTrabajadoresBase[actual]) trabajadorSelect.value = actual;
                document.getElementById('incTrabajadorGrupo').style.display = trabajadores.length ? '' : 'none';
            }
            actualizarFiltroValorIncidentes();
        }

        function actualizarFiltroValorIncidentes() {
            const campo = document.getElementById('incFiltroCampo')?.value || 'estado';
            const select = document.getElementById('incFiltroValor');
            if (!select) return;
            const actual = select.value;
            const opciones = campo === 'area_id'
                ? Object.values(cacheAreas).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')).map(a => [a.id, a.nombre])
                : (OPCIONES_INCIDENTES[campo] || []).map(valor => [valor, valor]);
            select.innerHTML = '<option value="">Todos</option>' + opciones.map(([valor, etiqueta]) => `<option value="${escapeHtml(valor)}">${escapeHtml(etiqueta)}</option>`).join('');
            if (opciones.some(([valor]) => valor === actual)) select.value = actual;
            renderizarIncidentes();
        }

        function renderizarIncidentes() {
            const lista = document.getElementById('incidentesLista');
            if (!lista) return;
            const busqueda = document.getElementById('incBuscar')?.value.trim().toLowerCase() || '';
            const campo = document.getElementById('incFiltroCampo')?.value || 'estado';
            const valor = document.getElementById('incFiltroValor')?.value || '';
            const filtrados = cacheIncidentes.filter(i => {
                const texto = `${i.codigo} ${i.descripcion} ${i.area_nombre} ${i.tipo} ${i.estado}`.toLowerCase();
                return (!busqueda || texto.includes(busqueda)) && (!valor || i[campo] === valor);
            });

            document.getElementById('incStatActivos').textContent = cacheIncidentes.filter(i => i.estado !== 'Cerrado').length;
            document.getElementById('incStatReportados').textContent = cacheIncidentes.filter(i => i.estado === 'Reportado').length;
            document.getElementById('incStatInvestigacion').textContent = cacheIncidentes.filter(i => i.estado === 'En investigación').length;
            document.getElementById('incStatGraves').textContent = cacheIncidentes.filter(i => ['Alta', 'Crítica'].includes(i.gravedad) && i.estado !== 'Cerrado').length;

            if (!filtrados.length) {
                lista.innerHTML = '<div class="incident-empty"><strong>No hay incidentes para mostrar</strong><span>Ajuste los filtros o registre un nuevo evento.</span></div>';
                return;
            }
            lista.innerHTML = filtrados.map(i => `
                <article class="incident-row">
                    <div class="incident-row-code"><span>${escapeHtml(i.codigo)}</span><small>${escapeHtml(fechaIncidente(i.fecha_evento, true))}</small></div>
                    <div class="incident-row-main"><strong>${escapeHtml(i.tipo)} · ${escapeHtml(i.area_nombre)}</strong><p>${escapeHtml(i.descripcion)}</p></div>
                    <span class="incident-badge ${claseEstadoIncidente(i.gravedad)}">${escapeHtml(i.gravedad)}</span>
                    <span class="incident-badge ${claseEstadoIncidente(i.estado)}">${escapeHtml(i.estado)}</span>
                    <button type="button" class="btn btn-outline btn-sm btn-ver-incidente" data-id="${escapeHtml(i.id)}">Ver detalle</button>
                </article>`).join('');
            lista.querySelectorAll('.btn-ver-incidente').forEach(btn => btn.addEventListener('click', () => abrirDetalleIncidente(btn.dataset.id)));
        }

        function iniciarSuscripcionIncidentes() {
            if (!currentUser) return;
            if (unsubscribeIncidentes) unsubscribeIncidentes();
            unsubscribeIncidentes = onSnapshot(coleccionIncidentes, snapshot => {
                cacheIncidentes = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.fecha_evento?.seconds || 0) - (a.fecha_evento?.seconds || 0));
                renderizarIncidentes();
            }, error => {
                console.error('Error al leer incidentes:', error);
                showToast('No fue posible cargar los incidentes.', 'error');
            });
        }

        const METODOS_INVESTIGACION = {
            '5 Porqués': {
                ayuda: 'Profundice una cadena causal dominante desde el evento hasta la causa sistémica.',
                campos: [
                    '1. ¿Por qué ocurrió?',
                    '2. ¿Por qué existía esa condición?',
                    '3. ¿Por qué el control no la evitó?',
                    '4. ¿Por qué el sistema permitió la falla?',
                    '5. ¿Por qué persiste la causa sistémica?'
                ]
            },
            'Ishikawa 6M': {
                ayuda: 'Analice causas concurrentes en las seis categorías; registre evidencia y descarte categorías no aplicables con justificación.',
                campos: ['Personas', 'Métodos', 'Máquinas y equipos', 'Materiales', 'Medición', 'Medio ambiente']
            },
            'Análisis de barreras': {
                ayuda: 'Determine qué controles debían prevenir o mitigar el evento y por qué resultaron insuficientes.',
                campos: ['Control esperado', 'Barreras existentes', 'Barreras que fallaron', 'Barreras ausentes', 'Causa de la falla de las barreras', 'Evidencia de efectividad o falla']
            }
        };

        function configuracionMetodoInvestigacion(metodologia) {
            return METODOS_INVESTIGACION[metodologia] || METODOS_INVESTIGACION['5 Porqués'];
        }

        function renderizarCamposMetodoInvestigacion() {
            const metodologia = document.getElementById('invMetodo').value;
            const configuracion = configuracionMetodoInvestigacion(metodologia);
            document.getElementById('invMetodoTitulo').textContent = `Metodología: ${metodologia}`;
            document.getElementById('invMetodoAyuda').textContent = configuracion.ayuda;
            document.getElementById('invCamposMetodo').innerHTML = configuracion.campos.map((etiqueta, indice) => `
                <div class="form-group">
                    <label for="invMetodoRespuesta${indice + 1}">${escapeHtml(etiqueta)} *</label>
                    <textarea class="form-control" id="invMetodoRespuesta${indice + 1}" rows="2" minlength="5" maxlength="1000" required></textarea>
                </div>`).join('');
        }

        document.getElementById('invMetodo').addEventListener('change', renderizarCamposMetodoInvestigacion);

        function renderizarAnalisisMetodo(inv) {
            if (inv.analisis_metodo) {
                const configuracion = configuracionMetodoInvestigacion(inv.metodologia);
                return `<div class="incident-five-whys">${configuracion.campos.map((etiqueta, indice) => `
                    <div><span>${escapeHtml(etiqueta)}</span><p>${escapeHtml(inv.analisis_metodo[`respuesta_${indice + 1}`] || 'No registrado')}</p></div>`).join('')}</div>`;
            }
            return `<ol class="incident-five-whys">
                ${[1, 2, 3, 4, 5].map(numero => `<li><span>¿Por qué ${numero}?</span><p>${escapeHtml(inv[`por_que_${numero}`])}</p></li>`).join('')}
            </ol>`;
        }

        async function abrirDetalleIncidente(id) {
            const i = cacheIncidentes.find(item => item.id === id);
            if (!i) return;
            document.getElementById('incDetalleCodigo').textContent = i.codigo;
            let investigacionHtml = '';
            try {
                const investigacionSnap = await getDoc(doc(coleccionIncidentes, id, 'investigacion', 'principal'));
                if (investigacionSnap.exists()) {
                    const inv = investigacionSnap.data();
                    investigacionHtml = `
                        <section class="incident-investigation-summary">
                            <div class="incident-investigation-title"><span>🔎</span><div><small>INVESTIGACIÓN CAUSAL</small><strong>${escapeHtml(inv.metodologia)}</strong></div></div>
                            <div class="incident-detail-block"><span>Hechos confirmados</span><p>${escapeHtml(inv.hechos_confirmados)}</p></div>
                            <div class="incident-detail-block"><span>Causa inmediata</span><p>${escapeHtml(inv.causa_inmediata)}</p></div>
                            ${renderizarAnalisisMetodo(inv)}
                            <div class="incident-detail-block incident-root-cause"><span>Causa raíz</span><p>${escapeHtml(inv.causa_raiz)}</p></div>
                            <div class="incident-detail-block"><span>Factores contribuyentes</span><p>${escapeHtml(inv.factores_contribuyentes || 'No registrados')}</p></div>
                        </section>`;
                }
            } catch (error) {
                console.error('Error al consultar la investigación:', error);
                investigacionHtml = '<p class="incident-inline-error">No fue posible cargar la investigación causal.</p>';
            }
            document.getElementById('incDetalleContenido').innerHTML = `
                <div class="incident-detail-grid">
                    <div><span>Estado</span><strong class="incident-badge ${claseEstadoIncidente(i.estado)}">${escapeHtml(i.estado)}</strong></div>
                    <div><span>Gravedad</span><strong class="incident-badge ${claseEstadoIncidente(i.gravedad)}">${escapeHtml(i.gravedad)}</strong></div>
                    <div><span>Tipo</span><strong>${escapeHtml(i.tipo)}</strong></div>
                    <div><span>Fecha del evento</span><strong>${escapeHtml(fechaIncidente(i.fecha_evento, true))}</strong></div>
                    <div><span>Área</span><strong>${escapeHtml(i.area_nombre)}</strong></div>
                    <div><span>Lugar específico</span><strong>${escapeHtml(i.lugar_especifico || 'No indicado')}</strong></div>
                </div>
                <div class="incident-detail-block"><span>Descripción</span><p>${escapeHtml(i.descripcion)}</p></div>
                <div class="incident-detail-block"><span>Acciones inmediatas</span><p>${escapeHtml(i.acciones_inmediatas || 'No registradas')}</p></div>
                ${investigacionHtml}`;
            const btnInvestigar = document.getElementById('btnIniciarInvestigacion');
            btnInvestigar.dataset.id = i.id;
            btnInvestigar.style.display = esGestorIncidentes() && i.estado === 'Reportado' ? '' : 'none';
            showModal('modalDetalleIncidente');
        }

        function abrirInvestigacionIncidente(id) {
            const incidente = cacheIncidentes.find(item => item.id === id);
            if (!incidente || !esGestorIncidentes() || incidente.estado !== 'Reportado') {
                showToast('El expediente no puede iniciar una investigación desde su estado actual.', 'error');
                return;
            }
            document.getElementById('formInvestigacionIncidente').reset();
            document.getElementById('invMetodo').value = '5 Porqués';
            renderizarCamposMetodoInvestigacion();
            document.getElementById('investigacionIncidenteId').value = id;
            document.getElementById('investigacionIncidenteCodigo').textContent = `Investigar ${incidente.codigo}`;
            hideModal('modalDetalleIncidente');
            showModal('modalInvestigacionIncidente');
        }

        document.getElementById('formInvestigacionIncidente').addEventListener('submit', async event => {
            event.preventDefault();
            if (!currentUser || !esGestorIncidentes()) return;
            const id = document.getElementById('investigacionIncidenteId').value;
            const incidente = cacheIncidentes.find(item => item.id === id);
            if (!incidente || incidente.estado !== 'Reportado') {
                showToast('El expediente cambió de estado. Actualice la página antes de continuar.', 'error');
                return;
            }
            const valores = {
                metodologia: document.getElementById('invMetodo').value,
                hechos_confirmados: document.getElementById('invHechos').value.trim(),
                causa_inmediata: document.getElementById('invCausaInmediata').value.trim(),
                causa_raiz: document.getElementById('invCausaRaiz').value.trim(),
                factores_contribuyentes: document.getElementById('invFactores').value.trim()
            };
            const configuracion = configuracionMetodoInvestigacion(valores.metodologia);
            const respuestas = configuracion.campos.map((_, indice) => document.getElementById(`invMetodoRespuesta${indice + 1}`).value.trim());
            valores.analisis_metodo = Object.fromEntries(Array.from({ length: 6 }, (_, indice) => [`respuesta_${indice + 1}`, respuestas[indice] || '']));
            if (valores.hechos_confirmados.length < 10 || ['causa_inmediata', 'causa_raiz'].some(campo => valores[campo].length < 5) || respuestas.some(respuesta => respuesta.length < 5)) {
                showToast('Complete el análisis con información verificable en todos los campos obligatorios.', 'error');
                return;
            }
            const btn = document.getElementById('btnSubmitInvestigacion');
            btn.disabled = true;
            btn.textContent = 'Guardando investigación…';
            try {
                const incidenteRef = doc(coleccionIncidentes, id);
                const investigacionRef = doc(incidenteRef, 'investigacion', 'principal');
                const historialRef = doc(collection(incidenteRef, 'historial'));
                const batch = writeBatch(db);
                batch.update(incidenteRef, { estado: 'En investigación', ultima_actualizacion: serverTimestamp() });
                batch.set(investigacionRef, {
                    ...valores,
                    investigador_id: currentUser.uid,
                    fecha_inicio: serverTimestamp(),
                    ultima_actualizacion: serverTimestamp()
                });
                batch.set(historialRef, {
                    tipo_evento: 'INICIO_INVESTIGACION',
                    descripcion: `Investigación causal iniciada con metodología ${valores.metodologia}.`,
                    usuario_id: currentUser.uid,
                    fecha: serverTimestamp()
                });
                await batch.commit();
                hideModal('modalInvestigacionIncidente');
                showToast(`✅ Investigación de ${incidente.codigo} iniciada`);
            } catch (error) {
                console.error('Error al iniciar la investigación:', error);
                showToast('No fue posible iniciar la investigación causal.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Iniciar y guardar investigación';
            }
        });

        function abrirFormularioIncidente() {
            if (!esGestorIncidentes()) {
                showToast('Su rol solo permite consultar incidentes.', 'error');
                return;
            }
            document.getElementById('formIncidente').reset();
            const ahora = new Date();
            ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
            document.getElementById('incFechaEvento').value = ahora.toISOString().slice(0, 16);
            document.getElementById('incFechaEvento').max = ahora.toISOString().slice(0, 16);
            actualizarOpcionesIncidentes();
            showModal('modalIncidente');
        }

        document.getElementById('formIncidente').addEventListener('submit', async event => {
            event.preventDefault();
            if (!currentUser || !esGestorIncidentes()) return;
            const btn = document.getElementById('btnSubmitIncidente');
            const areaId = document.getElementById('incArea').value;
            const area = cacheAreas[areaId];
            const fechaEvento = new Date(document.getElementById('incFechaEvento').value);
            const descripcion = document.getElementById('incDescripcion').value.trim();
            if (!area || Number.isNaN(fechaEvento.getTime()) || fechaEvento > new Date()) {
                showToast('Revise el área y la fecha del evento.', 'error');
                return;
            }
            if (descripcion.length < 10) {
                showToast('La descripción debe contener al menos 10 caracteres útiles.', 'error');
                return;
            }
            btn.disabled = true;
            btn.textContent = 'Guardando…';
            try {
                const incidenteRef = doc(coleccionIncidentes);
                const historialRef = doc(collection(incidenteRef, 'historial'));
                const codigo = `INC-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
                const datos = {
                    codigo,
                    tipo: document.getElementById('incTipo').value,
                    fecha_evento: fechaEvento,
                    area_id: areaId,
                    area_nombre: area.nombre,
                    descripcion,
                    gravedad: document.getElementById('incGravedad').value,
                    estado: 'Reportado',
                    reportado_por: currentUser.uid,
                    fecha_creacion: serverTimestamp(),
                    ultima_actualizacion: serverTimestamp()
                };
                const lugar = document.getElementById('incLugar').value.trim();
                const trabajador = document.getElementById('incTrabajador').value;
                const acciones = document.getElementById('incAcciones').value.trim();
                if (lugar) datos.lugar_especifico = lugar;
                if (trabajador) datos.trabajador_id = trabajador;
                if (acciones) datos.acciones_inmediatas = acciones;
                const batch = writeBatch(db);
                batch.set(incidenteRef, datos);
                batch.set(historialRef, { tipo_evento: 'REPORTE', descripcion: `Expediente ${codigo} reportado`, usuario_id: currentUser.uid, fecha: serverTimestamp() });
                await batch.commit();
                hideModal('modalIncidente');
                showToast(`✅ Incidente ${codigo} registrado`);
            } catch (error) {
                console.error('Error al registrar incidente:', error);
                showToast('No fue posible registrar el incidente.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Guardar reporte';
            }
        });

        document.getElementById('incFiltroCampo').addEventListener('change', actualizarFiltroValorIncidentes);
        document.getElementById('incFiltroValor').addEventListener('change', renderizarIncidentes);
        document.getElementById('incBuscar').addEventListener('input', renderizarIncidentes);

        // ============================================================
        // 7. MÓDULO DE CAPACITACIONES (PROGRAMACIÓN Y CONSULTA)
        // ============================================================
        const coleccionCapacitaciones = collection(db, 'artifacts', appId, 'public', 'data', 'capacitaciones');
        let cacheCapacitaciones = [];

        const OPCIONES_CAPACITACIONES = {
            estado: ['Programada', 'En curso', 'Completada', 'Cancelada'],
            modalidad: ['Presencial', 'Virtual', 'Mixta', 'Práctica en puesto'],
            alcance: ['Toda la organización', 'Área específica']
        };

        function esGestorCapacitaciones() {
            return ['Administrador', 'Responsable H&S'].includes(currentUserProfile?.rol);
        }

        function claseCapacitacion(valor) {
            return `training-badge-${String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '-')}`;
        }

        function fechaCapacitacion(valor) {
            if (!valor) return 'Sin fecha';
            const fecha = valor.toDate ? valor.toDate() : new Date(valor);
            if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
            return new Intl.DateTimeFormat('es-HN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }).format(fecha);
        }

        function actualizarFiltroValorCapacitaciones() {
            const campo = document.getElementById('capFiltroCampo')?.value || 'estado';
            const select = document.getElementById('capFiltroValor');
            if (!select) return;
            const actual = select.value;
            const valores = campo === 'categoria'
                ? [...new Set(cacheCapacitaciones.map(c => c.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
                : (OPCIONES_CAPACITACIONES[campo] || []);
            select.innerHTML = '<option value="">Todos</option>' + valores.map(valor => `<option value="${escapeHtml(valor)}">${escapeHtml(valor)}</option>`).join('');
            if (valores.includes(actual)) select.value = actual;
            renderizarCapacitaciones();
        }

        function renderizarCapacitaciones() {
            const lista = document.getElementById('capacitacionesLista');
            if (!lista) return;
            const busqueda = document.getElementById('capBuscar')?.value.trim().toLowerCase() || '';
            const campo = document.getElementById('capFiltroCampo')?.value || 'estado';
            const valor = document.getElementById('capFiltroValor')?.value || '';
            const ahora = new Date();
            const limite = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
            const fechaDe = item => item.fecha_inicio?.toDate ? item.fecha_inicio.toDate() : new Date(item.fecha_inicio);
            const filtradas = cacheCapacitaciones.filter(c => {
                const texto = `${c.codigo} ${c.titulo} ${c.categoria} ${c.instructor} ${c.area_nombre || ''} ${c.estado}`.toLowerCase();
                return (!busqueda || texto.includes(busqueda)) && (!valor || c[campo] === valor);
            });

            document.getElementById('capStatTotal').textContent = cacheCapacitaciones.length;
            document.getElementById('capStatProgramadas').textContent = cacheCapacitaciones.filter(c => c.estado === 'Programada').length;
            document.getElementById('capStatProximas').textContent = cacheCapacitaciones.filter(c => {
                const fecha = fechaDe(c);
                return c.estado === 'Programada' && !Number.isNaN(fecha.getTime()) && fecha >= ahora && fecha <= limite;
            }).length;
            document.getElementById('capStatVencidas').textContent = cacheCapacitaciones.filter(c => {
                const fecha = fechaDe(c);
                return c.estado === 'Programada' && !Number.isNaN(fecha.getTime()) && fecha < ahora;
            }).length;

            if (!filtradas.length) {
                lista.innerHTML = '<div class="training-empty"><strong>No hay capacitaciones para mostrar</strong><span>Ajuste los filtros o programe una nueva actividad.</span></div>';
                return;
            }
            lista.innerHTML = filtradas.map(c => `
                <article class="training-row">
                    <div class="training-row-code"><span>${escapeHtml(c.codigo)}</span><small>${escapeHtml(fechaCapacitacion(c.fecha_inicio))}</small></div>
                    <div class="training-row-main"><strong>${escapeHtml(c.titulo)}</strong><p>${escapeHtml(c.categoria)} · ${escapeHtml(c.instructor)} · ${escapeHtml(c.area_nombre || c.alcance)}</p></div>
                    <span class="training-badge">${escapeHtml(c.modalidad)}</span>
                    <span class="training-badge ${claseCapacitacion(c.estado)}">${escapeHtml(c.estado)}</span>
                </article>`).join('');
        }

        function actualizarAreaCapacitacion() {
            const grupo = document.getElementById('capAreaGrupo');
            const select = document.getElementById('capArea');
            if (!grupo || !select) return;
            const requiereArea = document.getElementById('capAlcance').value === 'Área específica';
            grupo.style.display = requiereArea ? '' : 'none';
            select.required = requiereArea;
            if (!requiereArea) select.value = '';
        }

        function abrirFormularioCapacitacion() {
            if (!esGestorCapacitaciones()) {
                showToast('Su rol solo permite consultar capacitaciones.', 'error');
                return;
            }
            document.getElementById('formCapacitacion').reset();
            const inicio = new Date(Date.now() + 60 * 60 * 1000);
            inicio.setMinutes(inicio.getMinutes() - inicio.getTimezoneOffset(), 0, 0);
            document.getElementById('capFechaInicio').value = inicio.toISOString().slice(0, 16);
            document.getElementById('capDuracion').value = 60;
            const areaSelect = document.getElementById('capArea');
            areaSelect.innerHTML = '<option value="">Seleccione un área…</option>' + Object.values(cacheAreas)
                .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'))
                .map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.nombre)}</option>`).join('');
            actualizarAreaCapacitacion();
            showModal('modalCapacitacion');
        }

        function iniciarSuscripcionCapacitaciones() {
            if (!currentUser) return;
            if (unsubscribeCapacitaciones) unsubscribeCapacitaciones();
            unsubscribeCapacitaciones = onSnapshot(coleccionCapacitaciones, snapshot => {
                cacheCapacitaciones = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (b.fecha_inicio?.seconds || 0) - (a.fecha_inicio?.seconds || 0));
                actualizarFiltroValorCapacitaciones();
            }, error => {
                console.error('Error al leer capacitaciones:', error);
                showToast('No fue posible cargar las capacitaciones.', 'error');
            });
        }

        document.getElementById('formCapacitacion').addEventListener('submit', async event => {
            event.preventDefault();
            if (!currentUser || !esGestorCapacitaciones()) return;
            const fechaInicio = new Date(document.getElementById('capFechaInicio').value);
            const alcance = document.getElementById('capAlcance').value;
            const areaId = document.getElementById('capArea').value;
            const area = cacheAreas[areaId];
            const titulo = document.getElementById('capTitulo').value.trim();
            const categoria = document.getElementById('capCategoria').value.trim();
            const instructor = document.getElementById('capInstructor').value.trim();
            const duracion = Number(document.getElementById('capDuracion').value);
            if (Number.isNaN(fechaInicio.getTime()) || titulo.length < 5 || categoria.length < 2 || instructor.length < 2 || !Number.isInteger(duracion) || duracion < 15 || duracion > 1440) {
                showToast('Revise los campos obligatorios de la programación.', 'error');
                return;
            }
            if (alcance === 'Área específica' && !area) {
                showToast('Seleccione un área válida para esta capacitación.', 'error');
                return;
            }
            const btn = document.getElementById('btnSubmitCapacitacion');
            btn.disabled = true;
            btn.textContent = 'Guardando…';
            try {
                const capacitacionRef = doc(coleccionCapacitaciones);
                const datos = {
                    codigo: `CAP-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
                    titulo,
                    categoria,
                    modalidad: document.getElementById('capModalidad').value,
                    fecha_inicio: fechaInicio,
                    duracion_minutos: duracion,
                    instructor,
                    alcance,
                    estado: 'Programada',
                    creado_por: currentUser.uid,
                    fecha_creacion: serverTimestamp(),
                    ultima_actualizacion: serverTimestamp()
                };
                if (alcance === 'Área específica') {
                    datos.area_id = areaId;
                    datos.area_nombre = area.nombre;
                }
                const lugar = document.getElementById('capLugar').value.trim();
                const objetivo = document.getElementById('capObjetivo').value.trim();
                if (lugar) datos.lugar = lugar;
                if (objetivo) datos.objetivo = objetivo;
                await setDoc(capacitacionRef, datos);
                hideModal('modalCapacitacion');
                showToast(`✅ Capacitación ${datos.codigo} programada`);
            } catch (error) {
                console.error('Error al programar capacitación:', error);
                showToast('No fue posible guardar la capacitación.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Guardar programación';
            }
        });

        document.getElementById('capFiltroCampo').addEventListener('change', actualizarFiltroValorCapacitaciones);
        document.getElementById('capFiltroValor').addEventListener('change', renderizarCapacitaciones);
        document.getElementById('capBuscar').addEventListener('input', renderizarCapacitaciones);
        document.getElementById('capAlcance').addEventListener('change', actualizarAreaCapacitacion);

        // ============================================================
        // 8. INTERFAZ DE USUARIO (NAVEGACIÓN Y MODALES)
        // ============================================================
        // Navegación del Sidebar
        const navItems = document.querySelectorAll('.nav-item');
        const pages = document.querySelectorAll('.page');

        navItems.forEach(item => {
            item.addEventListener('click', function() {
                // Validación de acceso antes de cambiar visualmente
                if (this.dataset.page === 'configuracion' && currentUserProfile?.rol !== 'Administrador') {
                    showToast('No tiene permisos para acceder a Configuración.', 'error');
                    return;
                }

                if (this.dataset.page === 'salud' && !['Médico Ocupacional', 'Responsable H&S'].includes(currentUserProfile?.rol)) {
                    showToast('No tiene permisos para acceder a Salud Ocupacional.', 'error');
                    return;
                }

                navItems.forEach(n => n.classList.remove('active'));
                this.classList.add('active');

                pages.forEach(p => p.classList.remove('active'));
                const pageId = 'page-' + this.dataset.page;
                document.getElementById(pageId).classList.add('active');

                document.getElementById('sidebar').classList.remove('open'); // Cierra en móvil

                // Cambiar el encabezado dependiendo de la página
                const headerTitle = document.querySelector('.header-title');
                if (this.dataset.page === 'salud') {
                    headerTitle.innerHTML = 'Salud Ocupacional <span>| Gestión de vigilancia médica y expedientes de salud ocupacional</span>';
                } else if (this.dataset.page === 'incidentes') {
                    headerTitle.innerHTML = 'Incidentes <span>| Reporte y trazabilidad de eventos de seguridad</span>';
                } else if (this.dataset.page === 'capacitaciones') {
                    headerTitle.innerHTML = 'Capacitaciones <span>| Formación, cumplimiento y desarrollo de competencias</span>';
                } else {
                    headerTitle.innerHTML = 'SISA <span>| Sistema Integral de Seguridad y Ambiente</span>';
                }
            });
        });

        // Toggle Menú Móvil
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Lógica de Modales Genérica
        function showModal(id) {
            document.getElementById(id).classList.add('show');
            document.body.style.overflow = 'hidden';
        }

        function hideModal(id) {
            document.getElementById(id).classList.remove('show');
            document.body.style.overflow = '';
        }

        // Asignar aperturas de modales
        document.getElementById('btnNuevaActaDash').addEventListener('click', () => showModal('modalActa'));
        document.getElementById('btnNuevaActa').addEventListener('click', () => showModal('modalActa'));
        document.getElementById('btnNuevoRiesgo').addEventListener('click', () => showModal('modalRiesgo'));
        document.getElementById('btnNuevoIncidente').addEventListener('click', abrirFormularioIncidente);
        document.getElementById('btnIniciarInvestigacion').addEventListener('click', event => abrirInvestigacionIncidente(event.currentTarget.dataset.id));
        document.getElementById('btnNuevaCapacitacion').addEventListener('click', abrirFormularioCapacitacion);

        // Asignar cierres de modales
        document.getElementById('btnCloseActa').addEventListener('click', () => hideModal('modalActa'));
        document.getElementById('btnCancelActa').addEventListener('click', () => hideModal('modalActa'));
        document.getElementById('btnCloseRiesgo').addEventListener('click', () => hideModal('modalRiesgo'));
        document.getElementById('btnCancelRiesgo').addEventListener('click', () => hideModal('modalRiesgo'));
        document.getElementById('btnCloseUsuario').addEventListener('click', () => hideModal('modalUsuario'));
        document.getElementById('btnCancelUsuario').addEventListener('click', () => hideModal('modalUsuario'));
        document.getElementById('btnCloseArea').addEventListener('click', () => hideModal('modalArea'));
        document.getElementById('btnCancelArea').addEventListener('click', () => hideModal('modalArea'));
        document.getElementById('btnCloseIncidente').addEventListener('click', () => hideModal('modalIncidente'));
        document.getElementById('btnCancelIncidente').addEventListener('click', () => hideModal('modalIncidente'));
        document.getElementById('btnCloseDetalleIncidente').addEventListener('click', () => hideModal('modalDetalleIncidente'));
        document.getElementById('btnCerrarDetalleIncidente').addEventListener('click', () => hideModal('modalDetalleIncidente'));
        document.getElementById('btnCloseInvestigacion').addEventListener('click', () => hideModal('modalInvestigacionIncidente'));
        document.getElementById('btnCancelInvestigacion').addEventListener('click', () => hideModal('modalInvestigacionIncidente'));
        document.getElementById('btnCloseCapacitacion').addEventListener('click', () => hideModal('modalCapacitacion'));
        document.getElementById('btnCancelCapacitacion').addEventListener('click', () => hideModal('modalCapacitacion'));

        // Cierre al dar clic fuera del modal
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', function(e) {
                if (e.target === this) hideModal(this.id);
            });
        });

        // Formulario Acta (Mockup para futuras implementaciones Firebase)
        document.getElementById('formActa').addEventListener('submit', (e) => {
            e.preventDefault();
            showToast('✅ Acta simulada guardada');
            hideModal('modalActa');
            e.target.reset();
        });

        // Exportar a window para uso en el script HTML (si es necesario)
        window.query = query;
        window.where = where;
        window.getDocs = getDocs;
