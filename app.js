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

        const ROLES_VALIDOS = [
            'Administrador',
            'Gerencia',
            'Responsable H&S',
            'Supervisor',
            'Trabajador'
        ];

        // ============================================================
        // 1.1 PERMISOS DE INTERFAZ
        // ============================================================
        function aplicarPermisosInterfaz() {
            const navConfiguracion = document.getElementById('navConfiguracion');
            if (!navConfiguracion) return;

            if (currentUserProfile && currentUserProfile.rol === 'Administrador') {
                navConfiguracion.style.display = '';
            } else {
                navConfiguracion.style.display = 'none';

                // Si la página actual es configuración (heredada de otra sesión), enviar al dashboard
                const pageConfiguracion = document.getElementById('page-configuracion');
                if (pageConfiguracion && pageConfiguracion.classList.contains('active')) {
                    // Remover active de configuracion
                    pageConfiguracion.classList.remove('active');
                    navConfiguracion.classList.remove('active');

                    // Activar dashboard
                    document.getElementById('page-dashboard').classList.add('active');
                    const navDashboard = document.querySelector('.nav-item[data-page="dashboard"]');
                    if (navDashboard) navDashboard.classList.add('active');
                }
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
                    iniciarSuscripcionTrabajadores();

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

                if (snapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No hay áreas registradas.</td></tr>';
                    return;
                }

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const id = docSnap.id;

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
                const nextStep = e.currentTarget.dataset.next;
                const currentStep = parseInt(nextStep) - 1;

                // Validación básica de HTML5 para el paso actual antes de avanzar
                const currentDiv = document.getElementById(`wizard-step-${currentStep}`);
                const inputsObligatorios = currentDiv.querySelectorAll('[required]');
                let valido = true;
                inputsObligatorios.forEach(input => {
                    if(!input.reportValidity()) valido = false;
                });

                if(valido) {
                    // Enable the button for the next step so user can tab manually later
                    const nextStepBtn = document.querySelector(`.wizard-step-btn[data-step="${nextStep}"]`);
                    if(nextStepBtn) nextStepBtn.disabled = false;

                    mostrarPasoWizard(nextStep);
                }
            });
        });

        document.querySelectorAll('.btn-prev-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                mostrarPasoWizard(e.currentTarget.dataset.prev);
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
                li.innerHTML = `${alergia} <button type="button" class="btn btn-sm btn-danger ml-2" onclick="window.removeAlergia(${index})">x</button>`;
                li.style.marginBottom = '5px';
                ulAlergias.appendChild(li);
            });

            // Condiciones
            const ulCondiciones = document.getElementById('t_condiciones_list');
            ulCondiciones.innerHTML = '';
            t_condiciones_array.forEach((condicion, index) => {
                const li = document.createElement('li');
                li.innerHTML = `${condicion} <button type="button" class="btn btn-sm btn-danger ml-2" onclick="window.removeCondicion(${index})">x</button>`;
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
                    tr.innerHTML = `
                        <td>${ex.tipo}</td>
                        <td>${ex.realizacion}</td>
                        <td>${ex.vencimiento}</td>
                        <td><button type="button" class="btn btn-sm btn-danger" onclick="window.removeExamen(${index})">🗑️</button></td>
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

            t_examenes_array.push({ tipo, realizacion, vencimiento });
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
                const semaforo = evaluarSemaforoMedico(t.examenes);
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
                const semaforo = evaluarSemaforoMedico(t.examenes);
                const fotoHtml = t.fotografia_url ?
                    `<img src="${t.fotografia_url}" alt="Foto de ${t.nombres}">` :
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
                        <div style="margin-bottom: 10px;">
                            <span class="badge badge-info">📦 Archivado</span>
                        </div>
                    `;
                    actionButtonHtml = `
                        <button class="options-btn btn-restaurar-trabajador" data-id="${t.id}" title="Restaurar expediente" style="font-size: 1.2em; background: none; border: none; cursor: pointer;">
                            ↩️
                        </button>
                    `;
                } else {
                    actionButtonHtml = `
                        <button class="options-btn btn-archivar-trabajador" data-id="${t.id}" title="Archivar expediente" style="font-size: 1.2em; background: none; border: none; cursor: pointer;">
                            📦
                        </button>
                    `;
                }

                const card = document.createElement('div');
                card.className = 'worker-card';
                card.innerHTML = `
                    <div class="worker-card-header">
                        <div class="worker-status-group">
                            ${badgeArchivado}
                            <div>
                                <span class="status-label">Estado laboral:</span>
                                <span class="badge ${colorEstadoLaboral}">${estadoLaboralT}</span>
                            </div>
                            <div>
                                <span class="status-label">Vigilancia médica:</span>
                                <span class="badge badge-${semaforo.color}">${semaforo.texto}</span>
                            </div>
                            <div>
                                <span class="status-label">Aptitud ocupacional:</span>
                                <span class="badge ${colorAptitudOcupacional}">${aptitudOcupacional}</span>
                            </div>
                        </div>
                        ${actionButtonHtml}
                    </div>

                    <div class="worker-card-body">
                        ${fotoHtml}
                        <h3>${t.nombres} ${t.apellidos}</h3>
                        <div class="role">${t.puesto_trabajo}</div>
                        <div class="dept">🏢 ${t.departamento}</div>
                    </div>

                    <div class="worker-card-footer">
                        <button class="btn-profile btn-ver-perfil" data-id="${t.id}">Perfil</button>
                        <button class="btn-history btn-ver-historial" data-id="${t.id}">Historial</button>
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

        document.getElementById('filterDepartamento').addEventListener('change', (e) => {
            filtrosTrabajadores.departamento = e.target.value;
            renderizarTarjetasTrabajadores();
        });

        document.getElementById('filterEstadoLaboral').addEventListener('change', (e) => {
            filtrosTrabajadores.estadoLaboral = e.target.value;
            renderizarTarjetasTrabajadores();
        });

        document.getElementById('filterEstadoMedico').addEventListener('change', (e) => {
            filtrosTrabajadores.estadoMedico = e.target.value;
            renderizarTarjetasTrabajadores();
        });

        document.getElementById('filterAptitudOcupacional').addEventListener('change', (e) => {
            filtrosTrabajadores.aptitudOcupacional = e.target.value;
            renderizarTarjetasTrabajadores();
        });

        document.getElementById('filterArchivo').addEventListener('change', (e) => {
            filtrosTrabajadores.archivo = e.target.value;
            renderizarTarjetasTrabajadores();
        });

        // Actualizar el select de filtros de departamento cuando se carga la página o cambian las áreas
        async function actualizarSelectFiltroDepartamentos() {
            const selectFiltro = document.getElementById('filterDepartamento');
            const valorActual = selectFiltro.value;
            selectFiltro.innerHTML = '<option value="">Todas las Áreas</option>';

            try {
                const snapshot = await getDocs(coleccionAreas);
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const option = document.createElement('option');
                    option.value = data.nombre;
                    option.textContent = data.nombre;
                    selectFiltro.appendChild(option);
                });
                selectFiltro.value = valorActual; // Mantener selección si existe
            } catch (error) {
                console.error("Error al cargar áreas para el filtro:", error);
            }
        }


        function iniciarSuscripcionTrabajadores() {
            if (!currentUser) return;

            actualizarSelectFiltroDepartamentos();

            unsubscribeTrabajadores = onSnapshot(coleccionTrabajadores, (snapshot) => {
                cacheTrabajadores = {};

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const id = docSnap.id;
                    cacheTrabajadores[id] = { ...data, id };
                });

                renderizarTarjetasTrabajadores();

            }, (error) => {
                console.error("Error al cargar trabajadores:", error);
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

            const semaforo = evaluarSemaforoMedico(t.examenes);

            document.getElementById('p_estado_laboral').innerHTML = `<span class="badge ${colorEstadoLaboral}">${estadoLaboralT}</span>`;
            document.getElementById('p_estado_vigilancia_medica').innerHTML = `<span class="badge badge-${semaforo.color}">${semaforo.texto}</span>`;

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
            if(!t.examenes || t.examenes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin registro de exámenes</td></tr>';
            } else {
                // Ordenar por fecha de realización descendente
                const examenesOrdenados = [...t.examenes].sort((a,b) => new Date(b.realizacion) - new Date(a.realizacion));
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
                        <td>${ex.tipo}</td>
                        <td>${ex.realizacion}</td>
                        <td>${ex.vencimiento}</td>
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

            document.getElementById('p_aptitud_ocupacional').innerHTML = `<span class="badge ${colorAptitud}">${aptitudOcupacional}</span>`;
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
            t_examenes_array = t.examenes ? [...t.examenes] : [];

            renderArrays();

            // Enable all tabs when editing, as we assume it's already filled
            document.querySelectorAll('.wizard-step-btn').forEach(btn => {
                btn.disabled = false;
            });

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

                    tipo_sangre: document.getElementById('t_tipo_sangre').value,
                    alergias: t_alergias_array,
                    condiciones_medicas: t_condiciones_array,

                    emergencia_contacto_nombre: document.getElementById('t_emergencia_nombre').value,
                    emergencia_contacto_parentesco: document.getElementById('t_emergencia_parentesco').value,
                    emergencia_contacto_telefono: document.getElementById('t_emergencia_telefono').value,

                    talla_ropa: document.getElementById('t_talla_ropa').value,
                    talla_calzado: document.getElementById('t_talla_calzado').value,
                    examenes: t_examenes_array,

                    aptitud_ocupacional: aptitudOcupacional,
                    aptitud_fecha: aptitudFecha,
                    aptitud_vigencia: aptitudVigencia,
                    aptitud_restricciones: aptitudOcupacional === 'Apto con restricciones' ? aptitudRestricciones : '',
                    aptitud_observaciones: aptitudObservaciones,

                    fechaActualizacion: new Date().toISOString()
                };

                if(fotoUrl) trabajadorData.fotografia_url = fotoUrl;

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


        // ============================================================
        // 6. INTERFAZ DE USUARIO (NAVEGACIÓN Y MODALES)
        // ============================================================
        // Navegación del Sidebar
        const navItems = document.querySelectorAll('.nav-item');
        const pages = document.querySelectorAll('.page');

        navItems.forEach(item => {
            item.addEventListener('click', function() {
                // Validación de acceso a configuración ANTES de cambiar visualmente
                if (this.dataset.page === 'configuracion' && (!currentUserProfile || currentUserProfile.rol !== 'Administrador')) {
                    showToast('No tiene permisos para acceder a Configuración.', 'error');
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

        // Asignar cierres de modales
        document.getElementById('btnCloseActa').addEventListener('click', () => hideModal('modalActa'));
        document.getElementById('btnCancelActa').addEventListener('click', () => hideModal('modalActa'));
        document.getElementById('btnCloseRiesgo').addEventListener('click', () => hideModal('modalRiesgo'));
        document.getElementById('btnCancelRiesgo').addEventListener('click', () => hideModal('modalRiesgo'));
        document.getElementById('btnCloseUsuario').addEventListener('click', () => hideModal('modalUsuario'));
        document.getElementById('btnCancelUsuario').addEventListener('click', () => hideModal('modalUsuario'));
        document.getElementById('btnCloseArea').addEventListener('click', () => hideModal('modalArea'));
        document.getElementById('btnCancelArea').addEventListener('click', () => hideModal('modalArea'));

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
