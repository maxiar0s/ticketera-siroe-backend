import { Op } from "sequelize";
import {
  EstadoInventarioModel,
  InventarioModel,
} from "../models/index.js";
import registrarLog from "../utils/logger.js";
import { normalizarCodigo, normalizarTexto } from "../utils/validators.js";

const inventarioIncludes = [
  {
    model: EstadoInventarioModel,
    as: "estadoInventario",
    attributes: ["id", "name"],
  },
];

const INVENTARIO_PERMITIDOS = [1, 2];

const parseValorInventario = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalizado = `${value}`.replace(/\s+/g, "").replace(",", ".");
  const numero = Number.parseFloat(normalizado);

  if (!Number.isFinite(numero) || numero < 0) {
    return null;
  }

  return numero.toFixed(2);
};

const obtenerEstadoInventario = async (estadoId) => {
  if (!estadoId && estadoId !== 0) {
    return null;
  }

  const parsed = Number.parseInt(`${estadoId}`, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return EstadoInventarioModel.findByPk(parsed);
};

const obtenerInventarioPorId = async (id) =>
  InventarioModel.findByPk(id, {
    include: inventarioIncludes,
  });

export const getInventarios = async (req, res) => {
  try {
    const { pagina = 1, limite = 10, buscar, estado } = req.query;

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 10, 1), 100);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    const termino = buscar ? `${buscar}`.trim() : "";

    if (termino) {
      where[Op.or] = [
        { sku: { [Op.like]: `%${termino}%` } },
        { nombre: { [Op.like]: `%${termino}%` } },
        { descripcion: { [Op.like]: `%${termino}%` } },
      ];
    }

    if (estado !== undefined && estado !== null && `${estado}`.trim() !== "") {
      const estadoNumero = Number.parseInt(`${estado}`, 10);
      if (!Number.isInteger(estadoNumero) || estadoNumero <= 0) {
        return res
          .status(400)
          .json({ error: "El estado de inventario indicado no es valido." });
      }

      where.estado = estadoNumero;
    }

    const { rows, count } = await InventarioModel.findAndCountAll({
      where,
      include: inventarioIncludes,
      order: [["id", "DESC"]],
      limit: limitNumber,
      offset,
      distinct: true,
    });

    return res.json({
      data: rows,
      total: count,
      pagina: pageNumber,
      paginasTotales: Math.ceil(count / limitNumber),
    });
  } catch (error) {
    console.error("Error al obtener inventario:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener el inventario." });
  }
};

export const getInventario = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ error: "Debe indicar el item de inventario a consultar." });
    }

    const inventario = await obtenerInventarioPorId(id);
    if (!inventario) {
      return res.status(404).json({ error: "Item de inventario no encontrado." });
    }

    return res.json(inventario);
  } catch (error) {
    console.error("Error al obtener item de inventario:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener el item de inventario." });
  }
};

export const crearInventario = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!INVENTARIO_PERMITIDOS.includes(usuario?.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para crear items de inventario." });
    }

    const { sku, nombre, descripcion, valor, estado } = req.body;

    const skuNormalizado = normalizarCodigo(sku);
    const nombreNormalizado = normalizarTexto(nombre);
    const descripcionNormalizada = normalizarTexto(descripcion);
    const valorNormalizado = parseValorInventario(valor);

    if (!skuNormalizado) {
      return res.status(400).json({ error: "El SKU es obligatorio." });
    }

    if (!nombreNormalizado) {
      return res.status(400).json({ error: "El nombre es obligatorio." });
    }

    if (valorNormalizado === null) {
      return res
        .status(400)
        .json({ error: "Debe indicar un valor valido para el item." });
    }

    const estadoInventario = await obtenerEstadoInventario(estado);
    if (!estadoInventario) {
      return res
        .status(400)
        .json({ error: "Debe indicar un estado de inventario valido." });
    }

    const existente = await InventarioModel.findOne({
      where: { sku: skuNormalizado },
    });
    if (existente) {
      return res
        .status(409)
        .json({ error: "Ya existe un item de inventario con ese SKU." });
    }

    const inventario = await InventarioModel.create({
      sku: skuNormalizado,
      nombre: nombreNormalizado,
      descripcion: descripcionNormalizada,
      valor: valorNormalizado,
      estado: estadoInventario.id,
    });

    await registrarLog(
      usuario.id,
      "CREAR_INVENTARIO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { inventarioId: inventario.id }
    );

    const detalle = await obtenerInventarioPorId(inventario.id);
    return res.status(201).json(detalle);
  } catch (error) {
    console.error("Error al crear item de inventario:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al crear el item de inventario." });
  }
};

export const actualizarInventario = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!INVENTARIO_PERMITIDOS.includes(usuario?.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para actualizar inventario." });
    }

    const { id } = req.params;
    const inventario = await InventarioModel.findByPk(id);
    if (!inventario) {
      return res.status(404).json({ error: "Item de inventario no encontrado." });
    }

    const { sku, nombre, descripcion, valor, estado } = req.body;
    const cambios = {};

    if (sku !== undefined) {
      const skuNormalizado = normalizarCodigo(sku);
      if (!skuNormalizado) {
        return res.status(400).json({ error: "El SKU no puede quedar vacio." });
      }

      if (skuNormalizado !== inventario.sku) {
        const existente = await InventarioModel.findOne({
          where: {
            sku: skuNormalizado,
            id: { [Op.ne]: inventario.id },
          },
        });
        if (existente) {
          return res
            .status(409)
            .json({ error: "Ya existe otro item de inventario con ese SKU." });
        }
      }

      cambios.sku = skuNormalizado;
    }

    if (nombre !== undefined) {
      const nombreNormalizado = normalizarTexto(nombre);
      if (!nombreNormalizado) {
        return res.status(400).json({ error: "El nombre no puede quedar vacio." });
      }
      cambios.nombre = nombreNormalizado;
    }

    if (descripcion !== undefined) {
      cambios.descripcion = normalizarTexto(descripcion);
    }

    if (valor !== undefined) {
      const valorNormalizado = parseValorInventario(valor);
      if (valorNormalizado === null) {
        return res
          .status(400)
          .json({ error: "Debe indicar un valor valido para el item." });
      }
      cambios.valor = valorNormalizado;
    }

    if (estado !== undefined) {
      const estadoInventario = await obtenerEstadoInventario(estado);
      if (!estadoInventario) {
        return res
          .status(400)
          .json({ error: "Debe indicar un estado de inventario valido." });
      }
      cambios.estado = estadoInventario.id;
    }

    if (!Object.keys(cambios).length) {
      return res
        .status(400)
        .json({ error: "Debe indicar al menos un campo para actualizar." });
    }

    await inventario.update(cambios);

    await registrarLog(
      usuario.id,
      "ACTUALIZAR_INVENTARIO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { inventarioId: inventario.id }
    );

    const detalle = await obtenerInventarioPorId(inventario.id);
    return res.json(detalle);
  } catch (error) {
    console.error("Error al actualizar item de inventario:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el item de inventario." });
  }
};

export const eliminarInventario = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (usuario?.tipoCuentaId !== 1) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para eliminar inventario." });
    }

    const { id } = req.params;
    const inventario = await InventarioModel.findByPk(id);
    if (!inventario) {
      return res.status(404).json({ error: "Item de inventario no encontrado." });
    }

    await inventario.destroy();

    await registrarLog(
      usuario.id,
      "ELIMINAR_INVENTARIO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { inventarioId: id }
    );

    return res.json({ mensaje: "Item de inventario eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar item de inventario:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el item de inventario." });
  }
};

export const getEstadosInventario = async (_req, res) => {
  try {
    const estados = await EstadoInventarioModel.findAll({
      order: [["name", "ASC"]],
    });
    return res.json(estados);
  } catch (error) {
    console.error("Error al obtener estados de inventario:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los estados de inventario." });
  }
};

export const crearEstadoInventario = async (req, res) => {
  try {
    const nombre = normalizarTexto(req.body?.name);
    if (!nombre) {
      return res
        .status(400)
        .json({ error: "Debe indicar un nombre para el estado." });
    }

    const existente = await EstadoInventarioModel.findOne({
      where: { name: nombre },
    });
    if (existente) {
      return res.status(409).json({ error: "Ese estado ya existe." });
    }

    const estado = await EstadoInventarioModel.create({ name: nombre });

    await registrarLog(
      req.usuario?.id,
      "CREAR_ESTADO_INVENTARIO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { estadoInventarioId: estado.id }
    );

    return res.status(201).json(estado);
  } catch (error) {
    console.error("Error al crear estado de inventario:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al crear el estado de inventario." });
  }
};

export const actualizarEstadoInventario = async (req, res) => {
  try {
    const { id } = req.params;
    const nombre = normalizarTexto(req.body?.name);

    if (!nombre) {
      return res
        .status(400)
        .json({ error: "Debe indicar un nombre para el estado." });
    }

    const estado = await EstadoInventarioModel.findByPk(id);
    if (!estado) {
      return res.status(404).json({ error: "Estado de inventario no encontrado." });
    }

    const existente = await EstadoInventarioModel.findOne({
      where: {
        name: nombre,
        id: { [Op.ne]: estado.id },
      },
    });
    if (existente) {
      return res.status(409).json({ error: "Ese estado ya existe." });
    }

    await estado.update({ name: nombre });

    await registrarLog(
      req.usuario?.id,
      "ACTUALIZAR_ESTADO_INVENTARIO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { estadoInventarioId: estado.id }
    );

    return res.json(estado);
  } catch (error) {
    console.error("Error al actualizar estado de inventario:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el estado de inventario." });
  }
};

export const eliminarEstadoInventario = async (req, res) => {
  try {
    const { id } = req.params;
    const estado = await EstadoInventarioModel.findByPk(id);
    if (!estado) {
      return res.status(404).json({ error: "Estado de inventario no encontrado." });
    }

    const inventariosAsociados = await InventarioModel.count({
      where: { estado: estado.id },
    });
    if (inventariosAsociados > 0) {
      return res.status(400).json({
        error:
          "No es posible eliminar el estado porque existen items de inventario asociados.",
      });
    }

    await estado.destroy();

    await registrarLog(
      req.usuario?.id,
      "ELIMINAR_ESTADO_INVENTARIO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { estadoInventarioId: id }
    );

    return res.json({ mensaje: "Estado de inventario eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar estado de inventario:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el estado de inventario." });
  }
};
