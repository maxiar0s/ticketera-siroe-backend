/**
 * @fileoverview Controlador de notificaciones.
 * Maneja la obtención y marcado de notificaciones como leídas.
 */

import { Op } from "sequelize";
import { NotificacionModel } from "../models/index.js";
import { parseIdArray } from "../utils/parsers.js";

// =====================================================
// Endpoints
// =====================================================

/**
 * Obtiene las notificaciones del usuario autenticado.
 * GET /notificaciones
 */
export const getNotificaciones = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: "Sesion no valida." });
    }

    const { leidas, limite = 50 } = req.query;
    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 50, 1), 200);

    const where = { cuentaId: usuario.id };

    if (leidas === "true") {
      where.leida = true;
    } else if (leidas === "false") {
      where.leida = false;
    }

    const notificaciones = await NotificacionModel.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: limitNumber,
    });

    const sinLeer = await NotificacionModel.count({
      where: { cuentaId: usuario.id, leida: false },
    });

    return res.json({
      data: notificaciones,
      sinLeer,
    });
  } catch (error) {
    console.error("Error al obtener notificaciones:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener las notificaciones." });
  }
};

/**
 * Marca notificaciones como leídas.
 * POST /notificaciones/leer
 */
export const marcarNotificacionesLeidas = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: "Sesion no valida." });
    }

    const { ids, todas } = req.body;

    if (todas === true) {
      await NotificacionModel.update(
        { leida: true },
        { where: { cuentaId: usuario.id, leida: false } }
      );
      return res.json({
        mensaje: "Todas las notificaciones fueron marcadas como leidas.",
      });
    }

    const idsNormalizados = parseIdArray(ids);
    if (!idsNormalizados.length) {
      return res
        .status(400)
        .json({
          error: "Debe indicar al menos un ID de notificacion o marcar todas.",
        });
    }

    await NotificacionModel.update(
      { leida: true },
      { where: { id: { [Op.in]: idsNormalizados }, cuentaId: usuario.id } }
    );

    return res.json({ mensaje: "Notificaciones marcadas como leidas." });
  } catch (error) {
    console.error("Error al marcar notificaciones como leidas:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al marcar las notificaciones." });
  }
};
