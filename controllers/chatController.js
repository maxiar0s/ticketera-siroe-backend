/**
 * @fileoverview Controlador de mensajes para tickets.
 * Maneja mensajes y actividad de tickets (sin tiempo real).
 */

import { Op } from "sequelize";
import {
  MensajeTicketModel,
  ActividadTicketModel,
  TicketModel,
  CuentaModel,
  CuentaCasaMatrizModel,
  NotificacionModel,
} from "../models/index.js";
import { enviarNotificacionChatEmail } from "../services/email/chatEmailService.js";

// =====================================================
// Helpers
// =====================================================

const THREAD_SUBJECT_PREFIX_REGEX = /^(\s*(re|rv|fw|fwd|aw)\s*:\s*)+/i;
const THREAD_TICKET_TAG_REGEX = /\[\s*ticket\s*#?\s*\d+\s*\]/gi;

const normalizeThreadSubject = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(THREAD_TICKET_TAG_REGEX, " ")
    .replace(THREAD_SUBJECT_PREFIX_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const parseEmailTicketDescription = (descripcion = "") => {
  if (typeof descripcion !== "string" || !descripcion.trim()) {
    return {
      cuerpo: "",
      remitenteEmail: null,
      remitenteNombre: null,
    };
  }

  const [cuerpoRaw, metadataRaw = ""] = descripcion.split(/\n---\n/i);
  const cuerpo = cuerpoRaw.trim();
  const remitenteEmailMatch = metadataRaw.match(/Correo original:\s*(.+)/i);
  const remitenteNombreMatch = metadataRaw.match(/Nombre remitente:\s*(.+)/i);

  return {
    cuerpo,
    remitenteEmail: remitenteEmailMatch?.[1]?.trim() || null,
    remitenteNombre: remitenteNombreMatch?.[1]?.trim() || null,
  };
};

const buildCorreoItemFromTicket = (ticket, ticketPrincipalId) => {
  const emailData = parseEmailTicketDescription(ticket.descripcion);
  const remitenteNombre =
    emailData.remitenteNombre ||
    ticket.creadoPor?.name ||
    emailData.remitenteEmail ||
    ticket.creatorEmail ||
    "Correo";

  return {
    id: `correo-ticket-${ticket.id}`,
    itemType: "correo",
    ticketId: ticketPrincipalId,
    sourceTicketId: ticket.id,
    asunto: ticket.titulo || `Ticket #${ticket.id}`,
    mensaje: emailData.cuerpo || ticket.descripcion || "",
    adjuntos: Array.isArray(ticket.adjuntos) ? ticket.adjuntos : [],
    createdAt: ticket.createdAt,
    estadoTicket: ticket.estadoTicket,
    esTicketPrincipal: ticket.id === ticketPrincipalId,
    remitente: {
      id: ticket.creadoPor?.id || null,
      name: remitenteNombre,
      email: emailData.remitenteEmail || ticket.creatorEmail || null,
      tipoCuentaId: ticket.creadoPor?.tipoCuentaId || null,
    },
  };
};

const isEmailActivity = (actividad) => {
  const metadata = actividad?.metadata || {};
  return actividad?.tipo === "comentario" && metadata.origen === "email";
};

const buildCorreoItemFromActividad = (actividad) => {
  const metadata = actividad.metadata || {};
  const remitenteNombre =
    metadata.remitenteNombre ||
    actividad.realizadoPor?.name ||
    metadata.remitenteEmail ||
    "Correo";

  return {
    id: `correo-actividad-${actividad.id}`,
    itemType: "correo",
    ticketId: actividad.ticketId,
    sourceTicketId: metadata.sourceTicketId || actividad.ticketId,
    asunto: metadata.asunto || actividad.valorNuevo || `Ticket #${actividad.ticketId}`,
    mensaje: metadata.cuerpo || "",
    adjuntos: Array.isArray(metadata.adjuntos) ? metadata.adjuntos : [],
    createdAt: actividad.createdAt,
    estadoTicket: metadata.estadoTicket || null,
    esTicketPrincipal:
      !metadata.sourceTicketId || metadata.sourceTicketId === actividad.ticketId,
    remitente: {
      id: metadata.remitenteCuentaId || actividad.realizadoPor?.id || null,
      name: remitenteNombre,
      email: metadata.remitenteEmail || null,
      tipoCuentaId:
        actividad.realizadoPor?.tipoCuentaId || metadata.remitenteTipoCuentaId || null,
    },
  };
};

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

    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 100, 1), 300);
    const ticketPrincipal = await TicketModel.findByPk(ticketId, {
      attributes: [
        "id",
        "titulo",
        "descripcion",
        "adjuntos",
        "createdAt",
        "estadoTicket",
        "fuente",
        "creatorEmail",
        "casaMatrizId",
      ],
      include: [
        {
          model: CuentaModel,
          as: "creadoPor",
          attributes: ["id", "name", "tipoCuentaId"],
        },
      ],
    });

    if (!ticketPrincipal) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }

    let ticketsRelacionados = [ticketPrincipal];
    const asuntoNormalizado = normalizeThreadSubject(ticketPrincipal.titulo || "");

    if (ticketPrincipal.fuente === "Email" && asuntoNormalizado) {
      const whereRelacionados = {
        fuente: "Email",
        casaMatrizId: ticketPrincipal.casaMatrizId,
      };

      if (ticketPrincipal.creatorEmail) {
        whereRelacionados.creatorEmail = ticketPrincipal.creatorEmail;
      }

      const candidatos = await TicketModel.findAll({
        where: whereRelacionados,
        attributes: [
          "id",
          "titulo",
          "descripcion",
          "adjuntos",
          "createdAt",
          "estadoTicket",
          "fuente",
          "creatorEmail",
          "casaMatrizId",
        ],
        include: [
          {
            model: CuentaModel,
            as: "creadoPor",
            attributes: ["id", "name", "tipoCuentaId"],
          },
        ],
        order: [["createdAt", "ASC"]],
      });

      ticketsRelacionados = candidatos.filter((candidate) => {
        return normalizeThreadSubject(candidate.titulo || "") === asuntoNormalizado;
      });

      if (!ticketsRelacionados.some((candidate) => candidate.id === ticketPrincipal.id)) {
        ticketsRelacionados.unshift(ticketPrincipal);
      }
    }

    const ticketIds = Array.from(
      new Set(ticketsRelacionados.map((ticket) => Number(ticket.id)).filter(Boolean)),
    );

    const mensajes = await MensajeTicketModel.findAll({
      where: { ticketId: { [Op.in]: ticketIds } },
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

    const actividades = await ActividadTicketModel.findAll({
      where: { ticketId: { [Op.in]: ticketIds } },
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

    const correosTickets = ticketsRelacionados.map((ticket) =>
      buildCorreoItemFromTicket(ticket, Number(ticketId)),
    );

    const correosActividad = actividades
      .filter((actividad) => isEmailActivity(actividad))
      .map((actividad) => buildCorreoItemFromActividad(actividad));

    const timeline = [
      ...mensajes.map((m) => ({ ...m.toJSON(), itemType: "mensaje" })),
      ...actividades
        .filter((actividad) => !isEmailActivity(actividad))
        .map((a) => ({ ...a.toJSON(), itemType: "actividad" })),
      ...correosTickets,
      ...correosActividad,
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

    // Procesar adjuntos si existen
    const adjuntos = Array.isArray(req.uploadedFiles) ? req.uploadedFiles : [];

    // Validar que haya mensaje o adjuntos
    const mensajeLimpio = mensaje ? mensaje.trim() : "";
    if (!mensajeLimpio && adjuntos.length === 0) {
      return res
        .status(400)
        .json({ error: "El mensaje no puede estar vacío." });
    }

    const acceso = await verificarAccesoTicket(ticketId, usuario);
    if (acceso.error) {
      return res.status(acceso.status).json({ error: acceso.error });
    }

    const nuevoMensaje = await MensajeTicketModel.create({
      ticketId: parseInt(ticketId, 10),
      cuentaId: usuario.id,
      mensaje: mensajeLimpio || "(Archivo adjunto)",
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

    // Enviar notificación al destinatario
    crearNotificacionMensaje(ticketId, usuario.id, mensaje.trim());

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

/**
 * Obtiene el conteo de mensajes no leídos por ticket para el usuario actual.
 * GET /tickets/mensajes-no-leidos
 */
export const getMensajesNoLeidosPorTicket = async (req, res) => {
  try {
    const usuario = req.usuario;

    // Construir condición de tickets accesibles según el rol del usuario
    let ticketCondition = {};

    if (usuario.tipoCuentaId === 4) {
      // Cliente: solo tickets de sus casas matrices
      const autorizados = await getAuthorizedClientIds(usuario.id);
      if (autorizados.length === 0) {
        return res.json({ data: {} });
      }

      // Obtener IDs de tickets accesibles
      const ticketsAccesibles = await TicketModel.findAll({
        where: { casaMatrizId: { [Op.in]: autorizados } },
        attributes: ["id"],
        raw: true,
      });
      const ticketIds = ticketsAccesibles.map((t) => t.id);

      if (ticketIds.length === 0) {
        return res.json({ data: {} });
      }
      ticketCondition = { ticketId: { [Op.in]: ticketIds } };
    } else if (usuario.tipoCuentaId === 2) {
      // Técnico: solo tickets nuevos, asignados a él, o donde esté en historial
      const todosTickets = await TicketModel.findAll({
        attributes: [
          "id",
          "estadoTicket",
          "tecnicoAsignadoId",
          "historialTransferencias",
        ],
        raw: true,
      });

      const ticketsAccesibles = todosTickets.filter((t) => {
        // Tickets nuevos (sin asignar)
        if (t.estadoTicket === "Nuevo" || !t.tecnicoAsignadoId) {
          return true;
        }
        // Asignado al usuario
        if (t.tecnicoAsignadoId === usuario.id) {
          return true;
        }
        // En historial de transferencias
        let historial = [];
        if (t.historialTransferencias) {
          try {
            historial = JSON.parse(t.historialTransferencias);
          } catch (e) {
            historial = [];
          }
        }
        for (const transferencia of historial) {
          if (
            transferencia.fromId === usuario.id ||
            transferencia.toId === usuario.id
          ) {
            return true;
          }
        }
        return false;
      });

      const ticketIds = ticketsAccesibles.map((t) => t.id);
      if (ticketIds.length === 0) {
        return res.json({ data: {} });
      }
      ticketCondition = { ticketId: { [Op.in]: ticketIds } };
    }
    // Admin ve todos los mensajes no leídos (sin condición adicional)

    // Obtener mensajes no leídos que no fueron enviados por el usuario
    const mensajesNoLeidos = await MensajeTicketModel.findAll({
      where: {
        ...ticketCondition,
        cuentaId: { [Op.ne]: usuario.id },
        leido: false,
      },
      attributes: ["ticketId"],
      raw: true,
    });

    // Agrupar por ticketId
    const conteo = {};
    for (const m of mensajesNoLeidos) {
      conteo[m.ticketId] = (conteo[m.ticketId] || 0) + 1;
    }

    return res.json({ data: conteo });
  } catch (error) {
    console.error("Error al obtener mensajes no leídos:", error);
    return res
      .status(500)
      .json({ error: "Error al obtener mensajes no leídos." });
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

    return actividad;
  } catch (error) {
    console.error("Error al registrar actividad:", error);
    return null;
  }
};

// =====================================================
// Helper para notificaciones
// =====================================================

const crearNotificacionMensaje = async (ticketId, remitenteId, mensaje) => {
  try {
    const ticket = await TicketModel.findByPk(ticketId, {
      include: [
        {
          model: CuentaModel,
          as: "creadoPor",
          attributes: ["id", "name", "email", "tipoCuentaId"],
        },
        {
          model: CuentaModel,
          as: "tecnicoAsignado",
          attributes: ["id", "name", "email", "tipoCuentaId"],
        },
      ],
    });

    if (!ticket) return;

    const destinatariosMap = new Map();

    // Técnico asignado recibe notificación si no fue él quien envió
    if (ticket.tecnicoAsignado && ticket.tecnicoAsignado.id !== remitenteId) {
      destinatariosMap.set(ticket.tecnicoAsignado.id, ticket.tecnicoAsignado);
    }

    // Cliente creador recibe notificación si no fue él quien envió
    if (ticket.creadoPor && ticket.creadoPor.id !== remitenteId) {
      // Solo notificar al cliente si el ticket tiene un técnico asignado (conversación activa)
      if (ticket.tecnicoAsignadoId) {
        destinatariosMap.set(ticket.creadoPor.id, ticket.creadoPor);
      }
    }

    // Incluir técnicos anteriores del historial de transferencias
    const historial = ticket.historialTransferencias || [];
    if (Array.isArray(historial) && historial.length > 0) {
      // Obtener IDs únicos de técnicos anteriores (fromId y toId de cada transferencia)
      const pastTecnicoIds = new Set();
      for (const transfer of historial) {
        if (transfer.fromId && transfer.fromId !== remitenteId) {
          pastTecnicoIds.add(transfer.fromId);
        }
        if (transfer.toId && transfer.toId !== remitenteId) {
          pastTecnicoIds.add(transfer.toId);
        }
      }

      // Excluir el técnico actual (ya está en destinatarios)
      if (ticket.tecnicoAsignadoId) {
        pastTecnicoIds.delete(ticket.tecnicoAsignadoId);
      }

      // Cargar datos de técnicos anteriores
      if (pastTecnicoIds.size > 0) {
        const pastTecnicos = await CuentaModel.findAll({
          where: { id: { [Op.in]: Array.from(pastTecnicoIds) } },
          attributes: ["id", "name", "email", "tipoCuentaId"],
        });
        for (const tec of pastTecnicos) {
          if (!destinatariosMap.has(tec.id)) {
            destinatariosMap.set(tec.id, tec);
          }
        }
      }
    }

    const destinatarios = Array.from(destinatariosMap.values());

    // Crear notificaciones y enviar emails
    const remitente = await CuentaModel.findByPk(remitenteId, {
      attributes: ["name"],
    });

    const remitenteNombre = remitente?.name || "Usuario";
    const ticketTitulo =
      ticket.titulo ||
      ticket.descripcion?.substring(0, 50) ||
      `Ticket #${ticketId}`;

    for (const dest of destinatarios) {
      // Verificar que no exista ya una notificación no leída del mismo ticket
      const existente = await NotificacionModel.findOne({
        where: {
          cuentaId: dest.id,
          referenciaId: ticketId,
          referenciaTipo: "ticket",
          tipo: "chat_mensaje",
          leida: false,
        },
      });

      if (!existente) {
        // Crear notificación en la base de datos
        await NotificacionModel.create({
          cuentaId: dest.id,
          tipo: "chat_mensaje",
          titulo: `Nuevo mensaje en ticket #${ticketId}`,
          mensaje: `${remitenteNombre}: ${mensaje.substring(0, 100)}${
            mensaje.length > 100 ? "..." : ""
          }`,
          referenciaId: ticketId,
          referenciaTipo: "ticket",
          leida: false,
          metadata: {
            remitenteId,
            remitenteNombre,
            ticketId,
            ticketTitulo,
          },
        });
      }

      // Enviar email de notificación
      await enviarNotificacionChatEmail({
        destinatario: dest,
        ticket,
        remitente: remitenteNombre,
        mensaje,
      });
    }
  } catch (error) {
    console.error("Error al crear notificación:", error);
  }
};

export default {
  getMensajesTicket,
  getActividadTicket,
  getTimelineTicket,
  enviarMensaje,
  marcarMensajesLeidos,
  getMensajesNoLeidosPorTicket,
  registrarActividadTicket,
};
