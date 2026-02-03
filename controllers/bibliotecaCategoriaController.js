/**
 * @fileoverview Controlador de Categorías de Biblioteca.
 * Maneja CRUD de categorías para documentación dinámica.
 */

import { Op } from "sequelize";
import BibliotecaCategoria from "../models/BibliotecaCategoria.js";
import { BibliotecaProyectoModel, CuentaModel } from "../models/index.js";

// Includes comunes para queries
const includeUsuarios = [
  {
    model: CuentaModel,
    as: "creadoPor",
    attributes: ["id", "name", "email"],
  },
  {
    model: CuentaModel,
    as: "actualizadoPor",
    attributes: ["id", "name", "email"],
  },
];

// =====================================================
// Endpoints
// =====================================================

/**
 * Lista todas las categorías de biblioteca.
 * GET /biblioteca/categorias
 */
export const getBibliotecaCategorias = async (req, res) => {
  try {
    const categorias = await BibliotecaCategoria.findAll({
      include: includeUsuarios,
      order: [["nombre", "ASC"]],
    });

    res.json(categorias);
  } catch (error) {
    console.error("Error al obtener categorías de biblioteca:", error);
    res.status(500).json({ error: "Error al obtener categorías" });
  }
};

/**
 * Obtiene una categoría por ID.
 * GET /biblioteca/categorias/:id
 */
export const getBibliotecaCategoria = async (req, res) => {
  try {
    const { id } = req.params;

    const categoria = await BibliotecaCategoria.findByPk(id, {
      include: includeUsuarios,
    });

    if (!categoria) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    res.json(categoria);
  } catch (error) {
    console.error("Error al obtener categoría:", error);
    res.status(500).json({ error: "Error al obtener categoría" });
  }
};

/**
 * Crea una nueva categoría de biblioteca.
 * POST /biblioteca/categorias
 */
export const crearBibliotecaCategoria = async (req, res) => {
  try {
    const { nombre, color, columnas } = req.body;
    const usuarioId = req.cuenta?.id;

    if (!nombre || nombre.trim().length === 0) {
      return res.status(400).json({ error: "El nombre es requerido" });
    }

    // Validar que no exista una categoría con el mismo nombre
    const existente = await BibliotecaCategoria.findOne({
      where: { nombre: nombre.trim() },
    });

    if (existente) {
      return res
        .status(400)
        .json({ error: "Ya existe una categoría con ese nombre" });
    }

    // Preparar columnas con IDs únicos si no los tienen
    let columnasFinales = columnas;
    if (columnas && Array.isArray(columnas)) {
      columnasFinales = columnas.map((col, index) => ({
        id: col.id || `col_${Date.now()}_${index}`,
        nombre: col.nombre || `Columna ${index + 1}`,
        tipoTexto: col.tipoTexto || "normal",
        permiteAdjuntos: col.permiteAdjuntos || false,
        orden: col.orden ?? index,
      }));
    }

    const categoria = await BibliotecaCategoria.create({
      nombre: nombre.trim(),
      color: color || "#6366f1",
      columnas: columnasFinales,
      creadoPorId: usuarioId,
    });

    // Recargar con includes
    const categoriaCompleta = await BibliotecaCategoria.findByPk(categoria.id, {
      include: includeUsuarios,
    });

    res.status(201).json(categoriaCompleta);
  } catch (error) {
    console.error("Error al crear categoría:", error);
    res.status(500).json({ error: "Error al crear categoría" });
  }
};

/**
 * Actualiza una categoría existente.
 * PUT /biblioteca/categorias/:id
 */
export const actualizarBibliotecaCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, color, columnas } = req.body;
    const usuarioId = req.cuenta?.id;

    const categoria = await BibliotecaCategoria.findByPk(id);
    if (!categoria) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    // Validar nombre único (excluyendo la actual)
    if (nombre && nombre.trim().length > 0) {
      const existente = await BibliotecaCategoria.findOne({
        where: {
          nombre: nombre.trim(),
          id: { [Op.ne]: id },
        },
      });

      if (existente) {
        return res
          .status(400)
          .json({ error: "Ya existe una categoría con ese nombre" });
      }
    }

    // Preparar datos de actualización
    const datosActualizacion = {
      actualizadoPorId: usuarioId,
    };

    if (nombre && nombre.trim().length > 0) {
      datosActualizacion.nombre = nombre.trim();
    }

    if (color) {
      datosActualizacion.color = color;
    }

    if (columnas && Array.isArray(columnas)) {
      datosActualizacion.columnas = columnas.map((col, index) => ({
        id: col.id || `col_${Date.now()}_${index}`,
        nombre: col.nombre || `Columna ${index + 1}`,
        tipoTexto: col.tipoTexto || "normal",
        permiteAdjuntos: col.permiteAdjuntos || false,
        orden: col.orden ?? index,
      }));
    }

    await categoria.update(datosActualizacion);

    // Recargar con includes
    const categoriaActualizada = await BibliotecaCategoria.findByPk(id, {
      include: includeUsuarios,
    });

    res.json(categoriaActualizada);
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    res.status(500).json({ error: "Error al actualizar categoría" });
  }
};

/**
 * Elimina una categoría de biblioteca.
 * DELETE /biblioteca/categorias/:id
 */
export const eliminarBibliotecaCategoria = async (req, res) => {
  try {
    const { id } = req.params;

    const categoria = await BibliotecaCategoria.findByPk(id);
    if (!categoria) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    // Verificar si hay documentos asociados
    const documentosAsociados = await BibliotecaProyectoModel.count({
      where: { categoriaId: id },
    });

    if (documentosAsociados > 0) {
      return res.status(400).json({
        error: `No se puede eliminar la categoría porque tiene ${documentosAsociados} documento(s) asociado(s)`,
      });
    }

    await categoria.destroy();

    res.json({ mensaje: "Categoría eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    res.status(500).json({ error: "Error al eliminar categoría" });
  }
};
