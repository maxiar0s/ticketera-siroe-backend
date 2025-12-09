/**
 * @fileoverview Controlador de chat para tickets.
 * Maneja mensajes y actividad de tickets.
 */

import { Op } from "sequelize";
import {
  MensajeTicketModel,
  ActividadTicketModel,
  TicketModel,
  CuentaModel,
  CuentaCasaMatrizModel,
} from "../models/index.js";
import {
  emitNewMessage,
  emitNewActivity,
  isUserOnline,
  getConnectedUsersInTicket,
} from "../config/socketServer.js";
import { enviarNotificacionChatEmail } from "../services/email/chatEmailService.js";

// =====================================================
// Helpers
// =====================================================

const getAuthorizedClientIds = async (cuentaId) => {
  const rows = await CuentaCasaMatrizModel.findAll({
    where: { cuentaId },
    attributes: ["casaMatrizId"],
    raw: true,
  });
  return rows.map((row) => row.casaMatrizId);
};

const verificarAccesoTicket = async (ticketId, usuario) => {
  const ticket = await TicketModel.findByPk(ticketId, {
    attributes: ["id", "casaMatrizId", "creadoPorId", "tecnicoAsignadoId"],
  });

  if (!ticket) {
    return { error: "Ticket no encontrado", status: 404 };
  }

  // Admin y técnicos tienen acceso a todos los tickets
  if ([1, 2].includes(usuario.tipoCuentaId)) {
    return { ticket };
  }

  // Clientes solo pueden acceder a tickets de sus clientes asociados
  if (usuario.tipoCuentaId === 4) {
    const autorizados = await getAuthorizedClientIds(usuario.id);
    if (!autorizados.includes(ticket.casaMatrizId)) {
      return { error: "No tiene acceso a este ticket", status: 403 };
    }
  }

  return { ticket };
};

// =====================================================
// Endpoints
// =====================================================

/**
 * Obtiene el historial de mensajes de un ticket.
 * GET /tickets/:ticketId/chat
 */
export const getMensajesTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { pagina = 1, limite = 50 } = req.query;
    const usuario = req.usuario;

    const acceso = await verificarAccesoTicket(ticketId, usuario);
    if (acceso.error) {
      return res.status(acceso.status).json({ error: acceso.error });
    }

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 50, 1), 100);
    const offset = (pageNumber - 1) * limitNumber;

    const { rows, count } = await MensajeTicketModel.findAndCountAll({
      where: { ticketId },
      include: [
        {
          model: CuentaModel,
          as: "remitente",
          attributes: ["id", "name", "tipoCuentaId"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: limitNumber,
      offset,
    });

    return res.json({
      data: rows.map((r) => r.toJSON()),
      total: count,
      pagina: pageNumber,
      paginasTotales: Math.ceil(count / limitNumber),
    });
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    return res
      .status(500)
      .json({ error: "Error al obtener mensajes del chat." });
  }
};

/**
 * Obtiene el historial de actividad de un ticket.
 * GET /tickets/:ticketId/actividad
 */
export const getActividadTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { pagina = 1, limite = 50 } = req.query;
    const usuario = req.usuario;

    const acceso = await verificarAccesoTicket(ticketId, usuario);
    if (acceso.error) {
      return res.status(acceso.status).json({ error: acceso.error });
    }

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 50, 1), 100);
    const offset = (pageNumber - 1) * limitNumber;

    const { rows, count } = await ActividadTicketModel.findAndCountAll({
      where: { ticketId },
      include: [
        {
          model: CuentaModel,
          as: "realizadoPor",
          attributes: ["id", "name", "tipoCuentaId"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: limitNumber,
      offset,
    });

    return res.json({
      data: rows.map((r) => r.toJSON()),
      total: count,
      pagina: pageNumber,
      paginasTotales: Math.ceil(count / limitNumber),
    });
  } catch (error) {
    console.error("Error al obtener actividad:", error);
    return res
      .status(500)
      .json({ error: "Error al obtener actividad del ticket." });
  }
};

/**
 * Obtiene mensajes y actividad combinados (timeline).
 * GET /tickets/:ticketId/timeline
 */
export const getTimelineTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { limite = 100 } = req.query;
    const usuario = req.usuario;

    const acceso = await verificarAccesoTicket(ticketId, usuario);
    if (acceso.error) {
      return res.status(acceso.status).json({ error: acceso.error });
    }

    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 100, 1), 200);

    // Obtener mensajes
    const mensajes = await MensajeTicketModel.findAll({
      where: { ticketId },
      include: [
        {
          model: CuentaModel,
          as: "remitente",
          attributes: ["id", "name", "tipoCuentaId"],
        },
      ],
      order: [["createdAt", "ASC"]],
      limit: limitNumber,
    });

    // Obtener actividades
    const actividades = await ActividadTicketModel.findAll({
      where: { ticketId },
      include: [
        {
          model: CuentaModel,
          as: "realizadoPor",
          attributes: ["id", "name", "tipoCuentaId"],
        },
      ],
      order: [["createdAt", "ASC"]],
      limit: limitNumber,
    });

    // Combinar y ordenar por fecha
    const timeline = [
      ...mensajes.map((m) => ({ ...m.toJSON(), itemType: "mensaje" })),
      ...actividades.map((a) => ({ ...a.toJSON(), itemType: "actividad" })),
    ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return res.json({
      data: timeline.slice(0, limitNumber),
      total: timeline.length,
    });
  } catch (error) {
    console.error("Error al obtener timeline:", error);
    return res
      .status(500)
      .json({ error: "Error al obtener timeline del ticket." });
  }
};

/**
 * Envía un nuevo mensaje en el chat del ticket.
 * POST /tickets/:ticketId/chat
 */
export const enviarMensaje = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { mensaje } = req.body;
    const usuario = req.usuario;

    if (!mensaje || !mensaje.trim()) {
      return res
        .status(400)
        .json({ error: "El mensaje no puede estar vacío." });
    }

    const acceso = await verificarAccesoTicket(ticketId, usuario);
    if (acceso.error) {
      return res.status(acceso.status).json({ error: acceso.error });
    }

    // Procesar adjuntos si existen
    const adjuntos = Array.isArray(req.uploadedFiles) ? req.uploadedFiles : [];

    const nuevoMensaje = await MensajeTicketModel.create({
      ticketId: parseInt(ticketId, 10),
      cuentaId: usuario.id,
      mensaje: mensaje.trim(),
      adjuntos,
      leido: false,
    });

    const mensajeCompleto = await MensajeTicketModel.findByPk(nuevoMensaje.id, {
      include: [
        {
          model: CuentaModel,
          as: "remitente",
          attributes: ["id", "name", "tipoCuentaId"],
        },
      ],
    });

    const respuesta = { ...mensajeCompleto.toJSON(), itemType: "mensaje" };

    // Emitir a todos en la sala del ticket
    emitNewMessage(ticketId, respuesta);

    // Verificar usuarios offline para enviar email
    enviarNotificacionSiOffline(ticketId, usuario.id, mensaje.trim());

    return res.status(201).json(respuesta);
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    return res.status(500).json({ error: "Error al enviar mensaje." });
  }
};

/**
 * Marca mensajes como leídos.
 * POST /tickets/:ticketId/chat/leidos
 */
export const marcarMensajesLeidos = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const usuario = req.usuario;

    const acceso = await verificarAccesoTicket(ticketId, usuario);
    if (acceso.error) {
      return res.status(acceso.status).json({ error: acceso.error });
    }

    // Marcar como leídos los mensajes que NO fueron enviados por el usuario actual
    await MensajeTicketModel.update(
      { leido: true },
      {
        where: {
          ticketId,
          cuentaId: { [Op.ne]: usuario.id },
          leido: false,
        },
      }
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Error al marcar mensajes como leídos:", error);
    return res
      .status(500)
      .json({ error: "Error al marcar mensajes como leídos." });
  }
};

// =====================================================
// Funciones de actividad
// =====================================================

/**
 * Registra una actividad en el ticket.
 * @param {Object} params
 * @param {number} params.ticketId
 * @param {number} params.cuentaId
 * @param {string} params.tipo
 * @param {string} [params.valorAnterior]
 * @param {string} [params.valorNuevo]
 * @param {Object} [params.metadata]
 */
export const registrarActividadTicket = async ({
  ticketId,
  cuentaId,
  tipo,
  valorAnterior = null,
  valorNuevo = null,
  metadata = {},
}) => {
  try {
    const actividad = await ActividadTicketModel.create({
      ticketId,
      cuentaId,
      tipo,
      valorAnterior,
      valorNuevo,
      metadata,
    });

    const actividadCompleta = await ActividadTicketModel.findByPk(
      actividad.id,
      {
        include: [
          {
            model: CuentaModel,
            as: "realizadoPor",
            attributes: ["id", "name", "tipoCuentaId"],
          },
        ],
      }
    );

    const respuesta = { ...actividadCompleta.toJSON(), itemType: "actividad" };

    // Emitir a todos en la sala del ticket
    emitNewActivity(ticketId, respuesta);

    return actividad;
  } catch (error) {
    console.error("Error al registrar actividad:", error);
    return null;
  }
};

// =====================================================
// Helper para notificaciones email
// =====================================================

const enviarNotificacionSiOffline = async (ticketId, remitenteId, mensaje) => {
  try {
    const ticket = await TicketModel.findByPk(ticketId, {
      include: [
        {
          model: CuentaModel,
          as: "creadoPor",
          attributes: ["id", "name", "email"],
        },
        {
          model: CuentaModel,
          as: "tecnicoAsignado",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    if (!ticket) return;

    const destinatarios = [];

    // Si el remitente es el cliente, notificar al técnico
    if (ticket.creadoPorId === remitenteId && ticket.tecnicoAsignado) {
      if (!isUserOnline(ticket.tecnicoAsignado.id)) {
        destinatarios.push(ticket.tecnicoAsignado);
      }
    }

    // Si el remitente es el técnico, notificar al cliente
    if (ticket.tecnicoAsignadoId === remitenteId && ticket.creadoPor) {
      if (!isUserOnline(ticket.creadoPor.id)) {
        destinatarios.push(ticket.creadoPor);
      }
    }

    // Enviar emails
    const remitente = await CuentaModel.findByPk(remitenteId, {
      attributes: ["name"],
    });
    for (const dest of destinatarios) {
      await enviarNotificacionChatEmail({
        destinatario: dest,
        ticket,
        remitente: remitente?.name || "Usuario",
        mensaje,
      });
    }
  } catch (error) {
    console.error("Error al enviar notificación email:", error);
  }
};

export default {
  getMensajesTicket,
  getActividadTicket,
  getTimelineTicket,
  enviarMensaje,
  marcarMensajesLeidos,
  registrarActividadTicket,
};
