const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const replacement = `
        navItems.forEach(item => {
            item.addEventListener('click', function() {
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
`;

content = content.replace(/navItems\.forEach\(item => \{[\s\S]*?\}\);\s*\}\);/, replacement.trim());
fs.writeFileSync('app.js', content, 'utf8');
