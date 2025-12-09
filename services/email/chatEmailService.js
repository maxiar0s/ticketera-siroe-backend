/**
 * @fileoverview Servicio de notificaciones por email para el chat de tickets.
 * Envía recordatorios cuando el destinatario está offline.
 */

import nodemailer from "nodemailer";

// Configuración del transporter SMTP
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Genera el HTML del email de notificación de chat.
 */
const generarHtmlNotificacion = ({ ticket, remitente, mensaje }) => {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuevo mensaje en ticket</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 25px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e91e63;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #e91e63;
    }
    .ticket-info {
      background: #fce4ec;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .ticket-id {
      font-size: 14px;
      color: #666;
    }
    .ticket-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-top: 5px;
    }
    .message-section {
      background: #f8f9fa;
      border-left: 4px solid #e91e63;
      padding: 15px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .sender {
      font-weight: 600;
      color: #e91e63;
      margin-bottom: 8px;
    }
    .message-text {
      color: #333;
      white-space: pre-wrap;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #e91e63, #c2185b);
      color: white !important;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 25px;
      font-weight: 600;
      margin-top: 20px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎫 Soporte Siroe</div>
    </div>
    
    <p>Tienes un nuevo mensaje en tu ticket:</p>
    
    <div class="ticket-info">
      <div class="ticket-id">Ticket #${ticket.id}</div>
      <div class="ticket-title">${ticket.titulo || "Sin título"}</div>
    </div>
    
    <div class="message-section">
      <div class="sender">${remitente} escribió:</div>
      <div class="message-text">${mensaje}</div>
    </div>
    
    <div style="text-align: center;">
      <a href="${
        process.env.FRONTEND_URL || "https://app.soportesiroe.cl"
      }/tickets" class="cta-button">
        Ver Ticket
      </a>
    </div>
    
    <div class="footer">
      <p>Este es un mensaje automático del sistema de soporte Siroe.</p>
      <p>Si no esperabas este correo, puedes ignorarlo.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Envía notificación por email cuando hay un nuevo mensaje de chat.
 * @param {Object} params
 * @param {Object} params.destinatario - Usuario destinatario { name, email }
 * @param {Object} params.ticket - Ticket { id, titulo }
 * @param {string} params.remitente - Nombre del remitente
 * @param {string} params.mensaje - Contenido del mensaje
 */
export const enviarNotificacionChatEmail = async ({
  destinatario,
  ticket,
  remitente,
  mensaje,
}) => {
  try {
    if (!destinatario?.email) {
      console.log("Destinatario sin email, omitiendo notificación");
      return false;
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("SMTP no configurado, omitiendo notificación email");
      return false;
    }

    const transport = getTransporter();

    const mailOptions = {
      from: `"Soporte Siroe" <${process.env.SMTP_USER}>`,
      to: destinatario.email,
      subject: `💬 Nuevo mensaje en Ticket #${ticket.id}`,
      html: generarHtmlNotificacion({ ticket, remitente, mensaje }),
    };

    await transport.sendMail(mailOptions);
    console.log(
      `Email de chat enviado a ${destinatario.email} para ticket #${ticket.id}`
    );
    return true;
  } catch (error) {
    console.error("Error al enviar email de notificación de chat:", error);
    return false;
  }
};

export default { enviarNotificacionChatEmail };
