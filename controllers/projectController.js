/**
 * @fileoverview Controlador de proyectos.
 * Maneja CRUD de proyectos, adjuntos y asignación de bitácoras.
 */

import { Op } from "sequelize";
import {
  BitacoraModel,
  CuentaModel,
  ProyectoModel,
  ProyectoAdjuntoModel,
  TicketModel,
} from "../models/index.js";
import registrarLog from "../utils/logger.js";
import { parseBooleanFlag, parseIdArray } from "../utils/parsers.js";
import { toISODateOnly } from "../utils/validators.js";
import { buildProyectoResponse } from "../utils/builders.js";

// =====================================================
// Includes y Helpers
// =====================================================

const proyectoIncludes = [
  { model: CuentaModel, as: "creadoPor", attributes: ["id", "name"] },
  { model: CuentaModel, as: "actualizadoPor", attributes: ["id", "name"] },
  { model: ProyectoAdjuntoModel, as: "adjuntos" },
];

const obtenerConteosBitacorasPorProyecto = async (proyectoIds) => {
  if (!Array.isArray(proyectoIds) || proyectoIds.length === 0) {
    return { bitacoraCountMap: new Map(), ticketCountMap: new Map() };
  }

  const [bitacoraRows, ticketRows] = await Promise.all([
    BitacoraModel.findAll({
      where: { proyectoId: { [Op.in]: proyectoIds } },
      attributes: [
        "proyectoId",
        [BitacoraModel.sequelize.fn("COUNT", "id"), "total"],
      ],
      group: ["proyectoId"],
      raw: true,
    }),
    TicketModel.findAll({
      where: { proyectoId: { [Op.in]: proyectoIds } },
      attributes: [
        "proyectoId",
        [TicketModel.sequelize.fn("COUNT", "id"), "total"],
      ],
      group: ["proyectoId"],
      raw: true,
    }),
  ]);

  const bitacoraCountMap = new Map();
  const ticketCountMap = new Map();

  bitacoraRows.forEach((row) => {
    bitacoraCountMap.set(row.proyectoId, parseInt(row.total, 10) || 0);
  });

  ticketRows.forEach((row) => {
    ticketCountMap.set(row.proyectoId, parseInt(row.total, 10) || 0);
  });

  return { bitacoraCountMap, ticketCountMap };
};

const cargarEncargadosMap = async (encargadoIds) => {
  if (!Array.isArray(encargadoIds) || encargadoIds.length === 0)
    return new Map();
  const cuentas = await CuentaModel.findAll({
    where: { id: { [Op.in]: encargadoIds } },
    attributes: ["id", "name"],
    raw: true,
  });
  const map = new Map();
  cuentas.forEach((cuenta) => map.set(cuenta.id, cuenta.name));
  return map;
};

const cargarProyectoDetalle = async (proyectoId) => {
  const proyecto = await ProyectoModel.findByPk(proyectoId, {
    include: proyectoIncludes,
  });
  if (!proyecto) return null;

  const { bitacoraCountMap, ticketCountMap } =
    await obtenerConteosBitacorasPorProyecto([proyecto.id]);

  const encargadoIds = Array.isArray(proyecto.encargados)
    ? proyecto.encargados
    : parseIdArray(proyecto.encargados);

  const encargadosMap = await cargarEncargadosMap(encargadoIds);

  return buildProyectoResponse(proyecto, {
    encargadosMap,
    bitacoraCountMap,
    ticketCountMap,
  });
};

// =====================================================
// Endpoints
// =====================================================

/**
 * Lista proyectos con paginación.
 * GET /proyectos
 */
export const getProyectos = async (req, res) => {
  try {
    const { pagina = 1, limite = 10, buscar } = req.query;

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 10, 1), 100);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    const terminoBusqueda = buscar ? `${buscar}`.trim() : "";
    if (terminoBusqueda) {
      where[Op.or] = [
        { nombre: { [Op.like]: `%${terminoBusqueda}%` } },
        { descripcion: { [Op.like]: `%${terminoBusqueda}%` } },
      ];
    }

    const { rows, count } = await ProyectoModel.findAndCountAll({
      where,
      include: proyectoIncludes,
      order: [["createdAt", "DESC"]],
      limit: limitNumber,
      offset,
      distinct: true,
    });

    const proyectoIds = rows.map((row) => row.id);
    const { bitacoraCountMap, ticketCountMap } =
      await obtenerConteosBitacorasPorProyecto(proyectoIds);

    const encargadoIds = new Set();
    rows.forEach((row) => {
      const ids = Array.isArray(row.encargados)
        ? row.encargados
        : parseIdArray(row.encargados);
      ids.forEach((id) => encargadoIds.add(id));
    });

    const encargadosMap = await cargarEncargadosMap(Array.from(encargadoIds));

    const data = rows.map((row) =>
      buildProyectoResponse(row, {
        encargadosMap,
        bitacoraCountMap,
        ticketCountMap,
      })
    );

    return res.json({
      data,
      total: count,
      pagina: pageNumber,
      paginasTotales: Math.ceil(count / limitNumber),
    });
  } catch (error) {
    console.error("Error al obtener proyectos:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los proyectos." });
  }
};

/**
 * Obtiene un proyecto por ID.
 * GET /proyectos/:id
 */
export const getProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ error: "Debe indicar el proyecto que desea consultar." });
    }

    const detalle = await cargarProyectoDetalle(id);
    if (!detalle) {
      return res.status(404).json({ error: "Proyecto no encontrado." });
    }

    return res.json(detalle);
  } catch (error) {
    console.error("Error al obtener proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener el proyecto." });
  }
};

/**
 * Crea un nuevo proyecto.
 * POST /proyectos
 */
export const crearProyecto = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para crear proyectos." });
    }

    let bodyData = req.body;
    if (req.body && req.body.payload) {
      try {
        bodyData = JSON.parse(req.body.payload);
      } catch (_err) {
        bodyData = req.body;
      }
    }

    const { nombre, descripcion, encargados, fechaInicio, fechaTermino } =
      bodyData;

    const nombreLimpio = nombre ? `${nombre}`.trim() : "";
    if (!nombreLimpio) {
      return res
        .status(400)
        .json({ error: "El nombre del proyecto es obligatorio." });
    }

    const descripcionLimpia = descripcion ? `${descripcion}`.trim() : null;
    const encargadosIds = parseIdArray(encargados);

    if (encargadosIds.length) {
      const existentes = await CuentaModel.findAll({
        where: { id: { [Op.in]: encargadosIds } },
        attributes: ["id"],
        raw: true,
      });
      const existentesSet = new Set(existentes.map((row) => row.id));
      const faltantes = encargadosIds.filter(
        (idEncargado) => !existentesSet.has(idEncargado)
      );
      if (faltantes.length) {
        return res
          .status(400)
          .json({ error: "Uno o mas encargados seleccionados no existen." });
      }
    }

    let fechaInicioNormalizada = null;
    if (
      typeof fechaInicio !== "undefined" &&
      fechaInicio !== null &&
      `${fechaInicio}`.trim() !== ""
    ) {
      const normalizada = toISODateOnly(fechaInicio);
      if (!normalizada) {
        return res
          .status(400)
          .json({ error: "La fecha de inicio del proyecto no es valida." });
      }
      fechaInicioNormalizada = normalizada;
    }

    let fechaTerminoNormalizada = null;
    if (
      typeof fechaTermino !== "undefined" &&
      fechaTermino !== null &&
      `${fechaTermino}`.trim() !== ""
    ) {
      const normalizada = toISODateOnly(fechaTermino);
      if (!normalizada) {
        return res
          .status(400)
          .json({ error: "La fecha de termino del proyecto no es valida." });
      }
      fechaTerminoNormalizada = normalizada;
    }

    if (
      fechaInicioNormalizada &&
      fechaTerminoNormalizada &&
      fechaTerminoNormalizada < fechaInicioNormalizada
    ) {
      return res
        .status(400)
        .json({
          error:
            "La fecha de termino no puede ser anterior a la fecha de inicio.",
        });
    }

    const proyecto = await ProyectoModel.create({
      nombre: nombreLimpio,
      descripcion: descripcionLimpia ?? null,
      encargados: encargadosIds,
      fechaInicio: fechaInicioNormalizada,
      fechaTermino: fechaTerminoNormalizada,
      fotoPortada: req.projectFoto?.storageName ?? null,
      creadoPorId: usuario.id,
      actualizadoPorId: usuario.id,
    });

    if (Array.isArray(req.projectArchivos) && req.projectArchivos.length) {
      await ProyectoAdjuntoModel.bulkCreate(
        req.projectArchivos.map((archivo) => ({
          proyectoId: proyecto.id,
          archivo: archivo.storageName,
          nombreArchivo: archivo.originalName ?? null,
          mimeType: archivo.mimeType ?? null,
          subidoPorId: usuario.id,
        }))
      );
    }

    const detalle = await cargarProyectoDetalle(proyecto.id);

    await registrarLog(
      usuario.id,
      "CREAR_PROYECTO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { proyectoId: proyecto.id }
    );

    return res.status(201).json(detalle);
  } catch (error) {
    console.error("Error al crear proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al crear el proyecto." });
  }
};

/**
 * Actualiza un proyecto.
 * PUT /proyectos/:id
 */
export const actualizarProyecto = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para actualizar proyectos." });
    }

    const { id } = req.params;
    const proyecto = await ProyectoModel.findByPk(id);
    if (!proyecto) {
      return res.status(404).json({ error: "Proyecto no encontrado." });
    }

    let bodyData = req.body;
    if (req.body && req.body.payload) {
      try {
        bodyData = JSON.parse(req.body.payload);
      } catch (_err) {
        bodyData = req.body;
      }
    }

    const {
      nombre,
      descripcion,
      encargados,
      fechaInicio,
      fechaTermino,
      eliminarFoto,
    } = bodyData;
    const cambios = {};

    if (typeof nombre !== "undefined") {
      const nombreLimpio = `${nombre ?? ""}`.trim();
      if (!nombreLimpio) {
        return res
          .status(400)
          .json({ error: "El nombre del proyecto no puede quedar vacio." });
      }
      cambios.nombre = nombreLimpio;
    }

    if (typeof descripcion !== "undefined") {
      const descripcionLimpia = `${descripcion ?? ""}`.trim();
      cambios.descripcion = descripcionLimpia.length ? descripcionLimpia : null;
    }

    if (typeof encargados !== "undefined") {
      const encargadosIds = parseIdArray(encargados);
      if (encargadosIds.length) {
        const existentes = await CuentaModel.findAll({
          where: { id: { [Op.in]: encargadosIds } },
          attributes: ["id"],
          raw: true,
        });
        const existentesSet = new Set(existentes.map((row) => row.id));
        const faltantes = encargadosIds.filter(
          (idEncargado) => !existentesSet.has(idEncargado)
        );
        if (faltantes.length) {
          return res
            .status(400)
            .json({ error: "Uno o mas encargados seleccionados no existen." });
        }
      }
      cambios.encargados = encargadosIds;
    }

    if (typeof fechaInicio !== "undefined") {
      const valor = `${fechaInicio ?? ""}`.trim();
      if (!valor || valor.toLowerCase() === "null") {
        cambios.fechaInicio = null;
      } else {
        const normalizada = toISODateOnly(valor);
        if (!normalizada) {
          return res
            .status(400)
            .json({ error: "La fecha de inicio del proyecto no es valida." });
        }
        cambios.fechaInicio = normalizada;
      }
    }

    if (typeof fechaTermino !== "undefined") {
      const valor = `${fechaTermino ?? ""}`.trim();
      if (!valor || valor.toLowerCase() === "null") {
        cambios.fechaTermino = null;
      } else {
        const normalizada = toISODateOnly(valor);
        if (!normalizada) {
          return res
            .status(400)
            .json({ error: "La fecha de termino del proyecto no es valida." });
        }
        cambios.fechaTermino = normalizada;
      }
    }

    const fechaInicioFinal = Object.prototype.hasOwnProperty.call(
      cambios,
      "fechaInicio"
    )
      ? cambios.fechaInicio
      : proyecto.fechaInicio;
    const fechaTerminoFinal = Object.prototype.hasOwnProperty.call(
      cambios,
      "fechaTermino"
    )
      ? cambios.fechaTermino
      : proyecto.fechaTermino;

    if (
      fechaInicioFinal &&
      fechaTerminoFinal &&
      fechaTerminoFinal < fechaInicioFinal
    ) {
      return res
        .status(400)
        .json({
          error:
            "La fecha de termino no puede ser anterior a la fecha de inicio.",
        });
    }

    const eliminarFotoFlag = parseBooleanFlag(eliminarFoto, false);
    if (req.projectFoto?.storageName) {
      cambios.fotoPortada = req.projectFoto.storageName;
    } else if (eliminarFotoFlag) {
      cambios.fotoPortada = null;
    }

    if (Object.keys(cambios).length) {
      cambios.actualizadoPorId = usuario.id;
      await proyecto.update(cambios);
    }

    if (Array.isArray(req.projectArchivos) && req.projectArchivos.length) {
      await ProyectoAdjuntoModel.bulkCreate(
        req.projectArchivos.map((archivo) => ({
          proyectoId: proyecto.id,
          archivo: archivo.storageName,
          nombreArchivo: archivo.originalName ?? null,
          mimeType: archivo.mimeType ?? null,
          subidoPorId: usuario.id,
        }))
      );
    }

    const detalle = await cargarProyectoDetalle(proyecto.id);

    await registrarLog(
      usuario.id,
      "MODIFICAR_PROYECTO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { proyectoId: proyecto.id }
    );

    return res.json(detalle);
  } catch (error) {
    console.error("Error al actualizar proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el proyecto." });
  }
};

/**
 * Elimina un proyecto.
 * DELETE /proyectos/:id
 */
export const eliminarProyecto = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (usuario.tipoCuentaId !== 1) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para eliminar proyectos." });
    }

    const { id } = req.params;
    const proyecto = await ProyectoModel.findByPk(id);
    if (!proyecto) {
      return res.status(404).json({ error: "Proyecto no encontrado." });
    }

    await BitacoraModel.update(
      { proyectoId: null },
      { where: { proyectoId: proyecto.id } }
    );
    await ProyectoAdjuntoModel.destroy({ where: { proyectoId: proyecto.id } });
    await proyecto.destroy();

    await registrarLog(
      usuario.id,
      "ELIMINAR_PROYECTO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { proyectoId: id }
    );

    return res.json({ mensaje: "Proyecto eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el proyecto." });
  }
};

/**
 * Agrega adjuntos a un proyecto.
 * POST /proyectos/:id/adjuntos
 */
export const agregarAdjuntosProyecto = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para adjuntar archivos." });
    }

    const { id } = req.params;
    const proyecto = await ProyectoModel.findByPk(id);
    if (!proyecto) {
      return res.status(404).json({ error: "Proyecto no encontrado." });
    }

    if (
      !Array.isArray(req.projectArchivos) ||
      req.projectArchivos.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "Debe adjuntar al menos un archivo." });
    }

    await ProyectoAdjuntoModel.bulkCreate(
      req.projectArchivos.map((archivo) => ({
        proyectoId: proyecto.id,
        archivo: archivo.storageName,
        nombreArchivo: archivo.originalName ?? null,
        mimeType: archivo.mimeType ?? null,
        subidoPorId: usuario.id,
      }))
    );

    const detalle = await cargarProyectoDetalle(proyecto.id);
    return res.json(detalle);
  } catch (error) {
    console.error("Error al adjuntar archivos al proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al adjuntar archivos al proyecto." });
  }
};

/**
 * Agrega bitácoras a un proyecto.
 * POST /proyectos/:id/bitacoras
 */
export const agregarBitacorasAProyecto = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para asignar bitacoras." });
    }

    const { id } = req.params;
    const proyecto = await ProyectoModel.findByPk(id);
    if (!proyecto) {
      return res.status(404).json({ error: "Proyecto no encontrado." });
    }

    let bodyData = req.body;
    if (req.body && req.body.payload) {
      try {
        bodyData = JSON.parse(req.body.payload);
      } catch (_err) {
        bodyData = req.body;
      }
    }

    const bitacoraIdsEntrada =
      bodyData?.bitacoraIds ?? bodyData?.bitacoras ?? bodyData?.tickets;
    const bitacoraIds = parseIdArray(bitacoraIdsEntrada);

    if (!bitacoraIds.length) {
      return res
        .status(400)
        .json({
          error: "Debe indicar al menos una bitacora o ticket a asignar.",
        });
    }

    const registros = await BitacoraModel.findAll({
      where: { id: { [Op.in]: bitacoraIds } },
      attributes: ["id"],
      raw: true,
    });
    const existentes = new Set(registros.map((row) => row.id));
    const faltantes = bitacoraIds.filter(
      (idBitacora) => !existentes.has(idBitacora)
    );
    if (faltantes.length) {
      return res
        .status(404)
        .json({
          error: "Una o mas bitacoras o tickets no existen.",
          faltantes,
        });
    }

    await BitacoraModel.update(
      { proyectoId: proyecto.id, actualizadoPorId: usuario.id },
      { where: { id: bitacoraIds } }
    );

    const detalle = await cargarProyectoDetalle(proyecto.id);
    return res.json(detalle);
  } catch (error) {
    console.error("Error al asignar bitacoras al proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al asignar bitacoras al proyecto." });
  }
};

/**
 * Quita una bitácora de un proyecto.
 * DELETE /proyectos/:id/bitacoras/:bitacoraId
 */
export const removerBitacoraDeProyecto = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para quitar bitacoras." });
    }

    const { id, bitacoraId } = req.params;
    const proyecto = await ProyectoModel.findByPk(id);
    if (!proyecto) {
      return res.status(404).json({ error: "Proyecto no encontrado." });
    }

    const bitacora = await BitacoraModel.findOne({
      where: { id: bitacoraId, proyectoId: proyecto.id },
    });
    if (!bitacora) {
      return res
        .status(404)
        .json({ error: "La bitacora indicada no esta asociada al proyecto." });
    }

    bitacora.proyectoId = null;
    bitacora.actualizadoPorId = usuario.id;
    await bitacora.save();

    const detalle = await cargarProyectoDetalle(proyecto.id);
    return res.json(detalle);
  } catch (error) {
    console.error("Error al quitar bitacora del proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al quitar la bitacora del proyecto." });
  }
};

/**
 * Elimina un adjunto de un proyecto.
 * DELETE /proyectos/:id/adjuntos/:adjuntoId
 */
export const eliminarProyectoAdjunto = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para eliminar adjuntos." });
    }

    const { id, adjuntoId } = req.params;
    const proyecto = await ProyectoModel.findByPk(id);
    if (!proyecto) {
      return res.status(404).json({ error: "Proyecto no encontrado." });
    }

    const adjunto = await ProyectoAdjuntoModel.findOne({
      where: { id: adjuntoId, proyectoId: proyecto.id },
    });
    if (!adjunto) {
      return res
        .status(404)
        .json({ error: "El adjunto indicado no pertenece al proyecto." });
    }

    await adjunto.destroy();

    const detalle = await cargarProyectoDetalle(proyecto.id);
    return res.json(detalle);
  } catch (error) {
    console.error("Error al eliminar adjunto del proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el adjunto del proyecto." });
  }
};
