        // Importaciones de Firebase (Mandatorias para este entorno)
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
        let unsubscribeRiesgos = null;
        let unsubscribeUsuarios = null;

        // ============================================================
        // 1. SISTEMA DE ALERTAS (TOASTS)
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

        // Auto-registro inicial del usuario admin para prevenir bloqueos en DB vacía
        async function ensureAdminUser() {
            try {
                await signInWithEmailAndPassword(auth, 'admin@sisa.com', 'admin123');
            } catch (error) {
                if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                    try {
                        const userCredential = await createUserWithEmailAndPassword(auth, 'admin@sisa.com', 'admin123');
                        const user = userCredential.user;

                        // Guardar en Firestore
                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usuarios', user.uid), {
                            nombre: 'Administrador Principal',
                            correo: 'admin@sisa.com',
                            rol: 'Administrador',
                            uid: user.uid,
                            fechaCreacion: new Date().toISOString()
                        });
                        console.log("Admin inicial creado.");
                    } catch (e) {
                        console.error("Error auto-registrando admin", e);
                    }
                }
            }
        }

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

            // Intentar auto-registro para asegurarse de que existe el admin por defecto
            if(emailInput.value === 'admin@sisa.com' && passwordInput.value === 'admin123') {
                await ensureAdminUser();
            }

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

                // Actualizar UI del usuario
                document.getElementById('userNameDisplay').textContent = user.email.split('@')[0];

                // Transición al Dashboard
                document.getElementById('loginContainer').classList.add('hidden');
                document.getElementById('appContainer').classList.add('show');
                showToast('✅ Conectado exitosamente');
                document.getElementById('loginBtn').disabled = false;
                document.getElementById('loginBtn').textContent = '🚀 Iniciar Sesión';

                // Iniciar la escucha de datos
                iniciarSuscripcionRiesgos();
                iniciarSuscripcionUsuarios();
            } else {
                currentUser = null;
                // Transición de vuelta al Login
                document.getElementById('appContainer').classList.remove('show');
                document.getElementById('loginContainer').classList.remove('hidden');
                document.getElementById('password').value = '';

                // Detener escucha de datos para ahorrar recursos
                if(unsubscribeRiesgos) unsubscribeRiesgos();
                if(unsubscribeUsuarios) unsubscribeUsuarios();
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
        // 4. MÓDULO DE USUARIOS (CREACIÓN, EDICIÓN Y LISTADO)
        // ============================================================
        const coleccionUsuarios = collection(db, 'artifacts', appId, 'public', 'data', 'usuarios');

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

        // ============================================================
        // 5. INTERFAZ DE USUARIO (NAVEGACIÓN Y MODALES)
        // ============================================================
        // Navegación del Sidebar
        const navItems = document.querySelectorAll('.nav-item');
        const pages = document.querySelectorAll('.page');

        navItems.forEach(item => {
            item.addEventListener('click', function() {
                navItems.forEach(n => n.classList.remove('active'));
                this.classList.add('active');

                pages.forEach(p => p.classList.remove('active'));
                const pageId = 'page-' + this.dataset.page;
                document.getElementById(pageId).classList.add('active');

                document.getElementById('sidebar').classList.remove('open'); // Cierra en móvil
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
