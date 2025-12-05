# Guía de Despliegue: Email Ticket Cron en Docker

## Opción A: Contenedor Separado (Recomendado)

### 1. Crear Dockerfile para el Cron

Crea un archivo `Dockerfile.cron` en la raíz del proyecto:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "scripts/email-ticket-cron.js"]
```

### 2. Subir cambios al servidor

```bash
# En tu máquina local
git add .
git commit -m "Add email ticket cron"
git push origin main
```

### 3. En el servidor VPS (SSH)

```bash
# Navegar al directorio del proyecto
cd /ruta/a/ss-ticketera-back

# Actualizar código
git pull origin main

# Construir imagen del cron
docker build -f Dockerfile.cron -t ticketera-cron:latest .

# Ejecutar el contenedor del cron
docker run -d \
  --name ticketera-email-cron \
  --restart unless-stopped \
  --env-file .env \
  ticketera-cron:latest
```

### 4. Verificar que está corriendo

```bash
# Ver logs del cron
docker logs -f ticketera-email-cron

# Verificar estado
docker ps | grep cron
```

---

## Opción B: Docker Compose (Si ya usas compose)

Agrega este servicio a tu `docker-compose.yml`:

```yaml
services:
  # Tu backend existente
  backend:
    build: .
    ports:
      - "5000:5000"
    env_file:
      - .env
    restart: unless-stopped

  # Nuevo: Email Cron
  email-cron:
    build:
      context: .
      dockerfile: Dockerfile.cron
    env_file:
      - .env
    restart: unless-stopped
    depends_on:
      - backend
```

Luego ejecuta:

```bash
docker-compose up -d --build email-cron
```

---

## Variables de Entorno Requeridas

Asegúrate de que tu `.env` en el servidor tenga:

```env
# Habilitar integración
TICKET_INBOUND_ENABLED=true

# IMAP (Gmail)
TICKET_INBOUND_IMAP_HOST=imap.gmail.com
TICKET_INBOUND_IMAP_PORT=993
TICKET_INBOUND_IMAP_SECURE=true
TICKET_INBOUND_IMAP_USER=ticketsiroe@gmail.com
TICKET_INBOUND_IMAP_PASSWORD=xxxx xxxx xxxx xxxx

# Cliente fallback
TICKET_INBOUND_FALLBACK_CLIENT_ID=LEXAqgpV6D5B
TICKET_INBOUND_FALLBACK_CREATOR_ID=1

# Dominios permitidos
TICKET_INBOUND_ALLOWED_SENDER_DOMAINS=soportesiroe.cl,siroe.cl

# Cada 5 minutos
TICKET_INBOUND_CRON_EXPRESSION="*/5 * * * *"
TICKET_INBOUND_TIMEZONE=America/Santiago

# SMTP para acuse de recibo
TICKET_OUTBOUND_SMTP_HOST=smtp.gmail.com
TICKET_OUTBOUND_SMTP_PORT=465
TICKET_OUTBOUND_SMTP_USER=ticketsiroe@gmail.com
TICKET_OUTBOUND_SMTP_PASSWORD=xxxx xxxx xxxx xxxx
```

---

## Comandos Útiles

```bash
# Ver logs en tiempo real
docker logs -f ticketera-email-cron

# Reiniciar el cron
docker restart ticketera-email-cron

# Detener el cron
docker stop ticketera-email-cron

# Eliminar y recrear
docker rm -f ticketera-email-cron
docker run -d --name ticketera-email-cron --restart unless-stopped --env-file .env ticketera-cron:latest

# Ejecutar una vez manualmente (sin el cron)
docker run --rm --env-file .env ticketera-cron:latest node scripts/email-ticket-processor.js
```

---

## Verificar Funcionamiento

1. Envía un email de prueba desde un dominio permitido
2. Espera 5 minutos (o el intervalo configurado)
3. Revisa los logs: `docker logs ticketera-email-cron`
4. Verifica en la app que el ticket fue creado
