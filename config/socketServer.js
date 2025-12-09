/**
 * @fileoverview Configuración del servidor Socket.io para chat en tiempo real.
 * Maneja autenticación JWT, salas por ticket, y eventos de chat.
 */

import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { CuentaModel } from "../models/index.js";

let io = null;

// Map de usuarios conectados: cuentaId -> Set de socketIds
const usuariosConectados = new Map();

/**
 * Inicializa el servidor Socket.io
 * @param {http.Server} httpServer - Servidor HTTP de Express
 * @returns {Server} Instancia de Socket.io
 */
export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "https://app.soportesiroe.cl",
        "https://demo.soportesiroe.cl",
        "https://ticket.siroe.cl",
        "http://localhost:4200",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Middleware de autenticación
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.headers?.token;

      if (!token) {
        return next(new Error("Token de autenticación requerido"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRETPASSWORD);
      const cuenta = await CuentaModel.findByPk(decoded.id, {
        attributes: ["id", "name", "email", "tipoCuentaId"],
      });

      if (!cuenta) {
        return next(new Error("Usuario no encontrado"));
      }

      socket.cuenta = cuenta;
      next();
    } catch (error) {
      console.error("Error de autenticación Socket.io:", error.message);
      next(new Error("Token inválido o expirado"));
    }
  });

  io.on("connection", (socket) => {
    const cuentaId = socket.cuenta.id;
    console.log(`Usuario conectado: ${socket.cuenta.name} (ID: ${cuentaId})`);

    // Registrar usuario conectado
    if (!usuariosConectados.has(cuentaId)) {
      usuariosConectados.set(cuentaId, new Set());
    }
    usuariosConectados.get(cuentaId).add(socket.id);

    // Unirse a sala de ticket
    socket.on("join_ticket", (ticketId) => {
      const sala = `ticket_${ticketId}`;
      socket.join(sala);
      console.log(`${socket.cuenta.name} se unió a sala ${sala}`);
    });

    // Salir de sala de ticket
    socket.on("leave_ticket", (ticketId) => {
      const sala = `ticket_${ticketId}`;
      socket.leave(sala);
      console.log(`${socket.cuenta.name} salió de sala ${sala}`);
    });

    // Indicador de escritura
    socket.on("typing", ({ ticketId, isTyping }) => {
      const sala = `ticket_${ticketId}`;
      socket.to(sala).emit("user_typing", {
        cuentaId: socket.cuenta.id,
        nombre: socket.cuenta.name,
        isTyping,
      });
    });

    // Desconexión
    socket.on("disconnect", () => {
      console.log(`Usuario desconectado: ${socket.cuenta.name}`);

      const sockets = usuariosConectados.get(cuentaId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          usuariosConectados.delete(cuentaId);
        }
      }
    });
  });

  return io;
};

/**
 * Obtiene la instancia de Socket.io
 * @returns {Server|null}
 */
export const getIO = () => io;

/**
 * Verifica si un usuario está conectado
 * @param {number} cuentaId
 * @returns {boolean}
 */
export const isUserOnline = (cuentaId) => {
  return (
    usuariosConectados.has(cuentaId) &&
    usuariosConectados.get(cuentaId).size > 0
  );
};

/**
 * Emite un nuevo mensaje a la sala del ticket
 * @param {number} ticketId
 * @param {Object} mensaje
 */
export const emitNewMessage = (ticketId, mensaje) => {
  if (io) {
    io.to(`ticket_${ticketId}`).emit("new_message", mensaje);
  }
};

/**
 * Emite una nueva actividad a la sala del ticket
 * @param {number} ticketId
 * @param {Object} actividad
 */
export const emitNewActivity = (ticketId, actividad) => {
  if (io) {
    io.to(`ticket_${ticketId}`).emit("new_activity", actividad);
  }
};

/**
 * Obtiene los IDs de usuarios conectados en una sala de ticket
 * @param {number} ticketId
 * @returns {number[]}
 */
export const getConnectedUsersInTicket = async (ticketId) => {
  if (!io) return [];

  const sala = `ticket_${ticketId}`;
  const sockets = await io.in(sala).fetchSockets();
  const cuentaIds = new Set();

  for (const socket of sockets) {
    if (socket.cuenta?.id) {
      cuentaIds.add(socket.cuenta.id);
    }
  }

  return Array.from(cuentaIds);
};

export default {
  initSocketServer,
  getIO,
  isUserOnline,
  emitNewMessage,
  emitNewActivity,
  getConnectedUsersInTicket,
};
