/**
 * @fileoverview Controlador de Tags.
 * Maneja CRUD de tags asociados a clientes (CasaMatriz).
 */

import { TagModel, CasaMatrizModel, TicketTagModel } from "../models/index.js";
import registrarLog from "../utils/logger.js";

/**
 * Lista todos los tags de un cliente.
 * GET /clientes/:clienteId/tags
 */
export const getTags = async (req, res) => {
  try {
    const { clienteId } = req.params;

    // Verificar que el cliente existe
    const cliente = await CasaMatrizModel.findByPk(clienteId);
    if (!cliente) {
      return res.status(404).json({ mensaje: "Cliente no encontrado" });
    }

    const tags = await TagModel.findAll({
      where: { casaMatrizId: clienteId },
      order: [["nombre", "ASC"]],
    });

    return res.json(tags);
  } catch (error) {
    console.error("Error al obtener tags:", error);
    return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

/**
 * Crea un nuevo tag para un cliente.
 * POST /clientes/:clienteId/tags
 */
export const crearTag = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const { nombre, color } = req.body;
    const usuarioId = req.user?.id;

    // Validaciones
    if (!nombre || !nombre.trim()) {
      return res
        .status(400)
        .json({ mensaje: "El nombre del tag es requerido" });
    }

    // Verificar que el cliente existe
    const cliente = await CasaMatrizModel.findByPk(clienteId);
    if (!cliente) {
      return res.status(404).json({ mensaje: "Cliente no encontrado" });
    }

    // Verificar que no exista un tag con el mismo nombre para este cliente
    const tagExistente = await TagModel.findOne({
      where: { casaMatrizId: clienteId, nombre: nombre.trim() },
    });
    if (tagExistente) {
      return res
        .status(400)
        .json({ mensaje: "Ya existe un tag con ese nombre para este cliente" });
    }

    const nuevoTag = await TagModel.create({
      nombre: nombre.trim(),
      color: color || "#6366f1",
      casaMatrizId: clienteId,
    });

    // Registrar log
    if (usuarioId) {
      await registrarLog(
        usuarioId,
        "CREAR_TAG",
        req.method,
        req.path,
        req.ip || req.connection.remoteAddress,
        { tagId: nuevoTag.id, nombre: nuevoTag.nombre, clienteId }
      );
    }

    return res.status(201).json(nuevoTag);
  } catch (error) {
    console.error("Error al crear tag:", error);
    return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

/**
 * Actualiza un tag existente.
 * PUT /clientes/:clienteId/tags/:tagId
 */
export const actualizarTag = async (req, res) => {
  try {
    const { clienteId, tagId } = req.params;
    const { nombre, color } = req.body;
    const usuarioId = req.user?.id;

    const tag = await TagModel.findOne({
      where: { id: tagId, casaMatrizId: clienteId },
    });

    if (!tag) {
      return res.status(404).json({ mensaje: "Tag no encontrado" });
    }

    // Si se cambia el nombre, verificar que no exista otro con el mismo nombre
    if (nombre && nombre.trim() !== tag.nombre) {
      const tagExistente = await TagModel.findOne({
        where: { casaMatrizId: clienteId, nombre: nombre.trim() },
      });
      if (tagExistente && tagExistente.id !== parseInt(tagId)) {
        return res
          .status(400)
          .json({ mensaje: "Ya existe un tag con ese nombre" });
      }
    }

    const nombreAnterior = tag.nombre;

    await tag.update({
      nombre: nombre ? nombre.trim() : tag.nombre,
      color: color || tag.color,
    });

    // Registrar log
    if (usuarioId) {
      await registrarLog(
        usuarioId,
        "ACTUALIZAR_TAG",
        req.method,
        req.path,
        req.ip || req.connection.remoteAddress,
        { tagId: tag.id, nombreAnterior, nombreNuevo: tag.nombre }
      );
    }

    return res.json(tag);
  } catch (error) {
    console.error("Error al actualizar tag:", error);
    return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

/**
 * Elimina un tag.
 * DELETE /clientes/:clienteId/tags/:tagId
 */
export const eliminarTag = async (req, res) => {
  try {
    const { clienteId, tagId } = req.params;
    const usuarioId = req.user?.id;

    const tag = await TagModel.findOne({
      where: { id: tagId, casaMatrizId: clienteId },
    });

    if (!tag) {
      return res.status(404).json({ mensaje: "Tag no encontrado" });
    }

    const nombreTag = tag.nombre;

    // Eliminar asociaciones con tickets primero
    await TicketTagModel.destroy({ where: { tagId: tag.id } });

    await tag.destroy();

    // Registrar log
    if (usuarioId) {
      await registrarLog(
        usuarioId,
        "ELIMINAR_TAG",
        req.method,
        req.path,
        req.ip || req.connection.remoteAddress,
        { tagId: parseInt(tagId), nombre: nombreTag }
      );
    }

    return res.json({ mensaje: "Tag eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar tag:", error);
    return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};
