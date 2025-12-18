# Automatización de tickets desde correo

Este módulo procesa correos entrantes en la casilla definida para soporte y crea tickets tipo **ingresado** en la aplicación (`Bitacoras` con `esTicket = true`). El procesador transforma el asunto en título, el cuerpo en nota y sube los adjuntos a Google Cloud Storage.

## 1. Configuración en la base de datos

1. **Cuenta “mesa de ayuda” (creador del ticket)**

   - Identifica el `id` de la cuenta que debe figurar como creadora/actualizadora de los tickets automáticos (por ejemplo, la cuenta de Mesa de Ayuda).
   - Si prefieres que el ticket quede asociado al usuario cliente que escribe el correo, basta con mantener `TICKET_INBOUND_USE_SENDER_ACCOUNT_AS_CREATOR=true` y no necesitas el id de la mesa.

2. **Correos de clientes**
   - Asegúrate de que los clientes tengan registrado su correo en:
     - `CasasMatrices.correo` **o**
     - `Cuentas.email` asociadas al cliente mediante `CuentasCasasMatrices`.

## 2. Variables de entorno (añadir al `.env` del backend)

```bash
# Activar / desactivar
TICKET_INBOUND_ENABLED=true

# Datos IMAP de la casilla exclusiva para tickets
TICKET_INBOUND_IMAP_HOST=imap.midominio.com
TICKET_INBOUND_IMAP_PORT=993
TICKET_INBOUND_IMAP_SECURE=true        # false sólo para puertos sin TLS
TICKET_INBOUND_IMAP_USER=tickets@midominio.com
TICKET_INBOUND_IMAP_PASSWORD=contraseña-super-secreta
TICKET_INBOUND_IMAP_MAILBOX=INBOX      # carpeta a monitorear

# Procesamiento
TICKET_INBOUND_POLL_INTERVAL_MS=60000  # sólo para modo --watch
TICKET_INBOUND_MAX_EMAILS_PER_RUN=20   # opcional
TICKET_INBOUND_TIMEZONE=America/Santiago
TICKET_INBOUND_CRON_EXPRESSION=*/5 * * * *   # frecuencia del cron interno

# Autorización de remitentes (opcionales)
TICKET_INBOUND_ALLOWED_SENDER_EMAILS=cliente1@midominio.com,cliente2@otra.cl
TICKET_INBOUND_ALLOWED_SENDER_DOMAINS=midominio.com,otra.cl

# Remitentes que NO deben recibir acuse de recibo (opcionales)
# Útil para correos automáticos, sistemas de notificación, etc.
TICKET_INBOUND_NO_REPLY_EMAILS=noreply@cliente.com,sistema@notificaciones.cl
TICKET_INBOUND_NO_REPLY_DOMAINS=noreply.ejemplo.com

# Ticket resultante
TICKET_INBOUND_DEFAULT_TECHNICIANS=Mesa de ayuda
TICKET_INBOUND_USE_SENDER_ACCOUNT_AS_CREATOR=true
# Si el remitente no tiene cuenta asociada se usará este id (opcional)
TICKET_INBOUND_FALLBACK_CREATOR_ID=123
# Cliente fallback si no se identifica al remitente (opcional)
TICKET_INBOUND_FALLBACK_CLIENT_ID=ABC123

# Comportamiento ante errores
TICKET_INBOUND_MARK_SEEN_ON_ERROR=false
TICKET_INBOUND_ARCHIVE_MAILBOX=Procesados   # mover correos procesados (opcional)

# SMTP para acuse de recibo (opcional, por defecto reutiliza la misma cuenta)
TICKET_OUTBOUND_ENABLED=true
TICKET_OUTBOUND_SMTP_HOST=smtp.gmail.com
TICKET_OUTBOUND_SMTP_PORT=465
TICKET_OUTBOUND_SMTP_SECURE=true
TICKET_OUTBOUND_SMTP_USER=tickets@midominio.com
TICKET_OUTBOUND_SMTP_PASSWORD=contraseña-app
TICKET_OUTBOUND_FROM_NAME=Mesa de Ayuda
TICKET_OUTBOUND_FROM_ADDRESS=tickets@midominio.com
TICKET_OUTBOUND_SUBJECT_PREFIX=[Ticket creado]
# Puedes personalizar el mensaje (variables: {ticketId}, {ticketTitle}, {originalSubject}, {clientName}, {createdAt})
TICKET_OUTBOUND_ACK_TEMPLATE="Hola,\n\nAcuso recibo: el ticket #{ticketId} ha sido creado correctamente con el asunto \"{ticketTitle}\".\n\nSaludos,\nMesa de Ayuda"
```

> **Notas**
>
> - Si usas `TICKET_INBOUND_ALLOWED_*` sólo se procesarán correos que cumplan el filtro. Si dejas ambos vacíos, se aceptan todos.
> - Configura `TICKET_INBOUND_FALLBACK_CREATOR_ID` con el `id` de la cuenta “Mesa de Ayuda” si no quieres que el creador sea el cliente.
> - El procesador sube adjuntos a GCS usando la configuración existente (`GCLOUD_*`).

## 3. Crear y proteger la casilla de correo

1. Crea un buzón dedicado (ej. `tickets@midominio.com`).
2. Habilita acceso IMAP.
3. Activa autenticación segura (TLS / contraseña de app si usas Google/Microsoft).
4. Opcional: aplica reglas en tu proveedor de correo para redirigir únicamente los mensajes relevantes a este buzón.

## 4. Ejecutar el procesador

Instala dependencias (ya declaradas):

```bash
cd app-soporte-siroe
npm install
```

### Ejecución manual

```bash
npm run tickets:email
```

### Ejecución continua (cron / servicio)

```bash
npm run tickets:email -- --watch         # pooling en vivo
npm run tickets:cron -- --now            # cron interno (ejecuta ahora y queda programado)
```

En modo `--watch`, el proceso consulta la casilla cada `TICKET_INBOUND_POLL_INTERVAL_MS` milisegundos.  
El cron interno usa `TICKET_INBOUND_CRON_EXPRESSION` (por defecto cada 5 minutos) y respeta la zona horaria definida en `TICKET_INBOUND_TIMEZONE`.

## 5. Automatizar en producción

1. **Cron interno (recomendado)**
   - Arranca con `npm run tickets:cron -- --now`.
   - Supervísalo con PM2, systemd o el Programador de tareas de Windows para reiniciarlo si la instancia se cae.
2. **Cron/PM2 tradicional**
   - Linux (cron): `*/5 * * * * /usr/bin/node /ruta/app-soporte-siroe/scripts/email-ticket-processor.js`
   - PM2: `pm2 start scripts/email-ticket-processor.js --name tickets-email --watch -- --watch`
3. **Logs**
   - Revisa los logs para detectar remitentes sin cliente asociado u otros errores.
   - Ajusta `TICKET_INBOUND_MARK_SEEN_ON_ERROR` si prefieres que los correos con errores no queden sin leer.

## 6. Personalizaciones recomendadas

- **Técnicos por defecto**: define una lista separada por comas para que aparezca el responsable inicial del ticket.
- **Fallback de cliente**: útil para correos sin coincidencia. Luego puedes reasignar manualmente.
- **Reglas anti-spam**: configura filtros en el servidor de correo para evitar que ingresen tickets no deseados.
- **Alertas**: considera añadir monitoreo (ej. un dashboard) para detectar si el procesador deja de crear tickets.

---

Con estos pasos la integración queda lista: cualquier correo que llegue a la casilla configurada desencadenará automáticamente la creación de un ticket “ingresado” con título, nota y adjuntos del mensaje.
