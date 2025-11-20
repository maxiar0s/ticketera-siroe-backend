# Demo Soporte Siroe

Esta guía resume cómo levantar el entorno demo (datos ficticios) y cómo desplegar cada pieza posteriormente.

## 1. Preparar el backend (Droplet DigitalOcean)

1. **Variables**: copia `app-soporte-siroe/.env.demo` a `.env` y ajusta host/credenciales reales de la base demo, clave JWT y, si corresponde, las credenciales de GCS o deja esos valores vacíos para desactivar adjuntos en la demo.
2. **Dependencias**: dentro de `app-soporte-siroe` ejecuta `npm install`.
3. **Base de datos**: crea una base nueva (ej. `soporte_siroe_demo`) y apunta las variables `DB_*` a esa instancia.
4. **Semillas demo**:
   ```bash
   npm run db:importar-demo
   npm run departamentos:sync
   ```
   El primer comando pobla todos los catálogos y los datos ficticios (clientes, usuarios, equipos) y el segundo genera los departamentos en base a los equipos cargados.
5. **Arranque**: `npm run start` levanta la API en el puerto definido en `.env`. En el droplet puedes dejarlo corriendo con PM2 o un servicio systemd y, opcionalmente, servirlo detrás de Nginx/Caddy apuntando a `http://127.0.0.1:PORT`.

## 2. Base de datos demo

1. Sobre la instancia MySQL/MariaDB del droplet crea la base `soporte_siroe_demo` (o el nombre que definas en `.env`).
2. Ejecuta las migraciones automáticamente con `npm run db:importar-demo` (hace `sync({force: true})`), por lo que no necesitas scripts SQL adicionales.
3. Cada vez que quieras regenerar la data demo repite `npm run db:importar-demo` seguido de `npm run departamentos:sync`.

## 3. Frontend (cPanel)

1. Desde `front-soporte-siroe` instala dependencias una vez con `npm install`.
2. Construye la versión demo apuntando al backend del droplet:
   ```bash
   npm run build:demo
   ```
   Si tu API demo no vive en `https://demo-api.soportesiroe.cl` actualiza `src/environments/environment.demo.ts` antes del build.
3. El build queda en `front-soporte-siroe/dist/front-siroe-soporte`. Comprime esa carpeta (zip) y súbela a `public_html/demo` (o el directorio que definas) mediante el Administrador de Archivos o FTP en cPanel.
4. Configura un subdominio (p.ej. `demo.midominio.cl`) en cPanel apuntando a la carpeta donde colocaste el build. Para SPA añade un `.htaccess` con la regla habitual:
   ```
   RewriteEngine On
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^ index.html [L]
   ```

## 4. Flujo sugerido de despliegue

1. **Droplet**: clona el repo, copia `.env.demo`→`.env`, instala dependencias y levanta la API con PM2 (`pm2 start api/index.js --name soporte-demo`).
2. **Base**: crea/importa la base y corre las semillas demo.
3. **Front**: ejecuta `npm run build:demo`, sube el contenido a cPanel y verifica que `environment.demo.ts` apunte al dominio/API del droplet (asegura HTTPS + CORS).
4. **Smoke test**: usa las credenciales demo (admin.demo@siroe.cl / Demo123*) para recorrer login, listado de clientes, sucursales y equipos. Valida que el front consuma `https://TU_BACKEND_API` sin errores CORS.

Con estos pasos tienes un entorno aislado con datos ficticios listo para demostraciones y fácil de resetear cuando necesites regenerar la información.

## 5. Credenciales demo sugeridas

- Admin: `admin.demo@siroe.cl / Demo123*`
- Mesa de ayuda: `mesa.demo@siroe.cl / Demo123*`
- Comercial: `comercial.demo@siroe.cl / Demo123*`
- Cliente Albatros: `cliente.albatros@siroe.cl / Demo123*`
