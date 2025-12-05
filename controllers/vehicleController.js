/**
 * @fileoverview Controlador de vehículos y salidas.
 * Maneja CRUD de vehículos y registro de salidas con adjuntos.
 */

import { Op } from "sequelize";
import {
  CuentaModel,
  VehiculoModel,
  VehiculoSalidaModel,
  VehiculoSalidaAdjuntoModel,
} from "../models/index.js";
import { metodosPago as vehiculoMetodosPago } from "../models/VehiculoSalida.js";
import registrarLog from "../utils/logger.js";
import {
  parseBooleanFlag,
  parseIdArray,
  parseDateTimeValue,
  parseDecimalValue,
} from "../utils/parsers.js";
import {
  normalizarMetodoPagoCombustible,
  normalizarTexto,
} from "../utils/validators.js";
import {
  buildVehiculoResponse,
  buildVehiculoSalidaResponse,
} from "../utils/builders.js";

// =====================================================
// Includes
// =====================================================

const vehiculoSalidaIncludes = [
  { model: VehiculoSalidaAdjuntoModel, as: "adjuntos" },
  {
    model: CuentaModel,
    as: "tecnicos",
    attributes: ["id", "name"],
    through: { attributes: [] },
  },
];

// =====================================================
// Helpers
// =====================================================

const obtenerTecnicoIdsDesdeBody = (body) => {
  const raw = body?.tecnicoIds ?? body?.tecnicos ?? body?.tecnicosIds;
  if (raw === undefined || raw === null) return undefined;
  return parseIdArray(raw);
};

// =====================================================
// Endpoints de Vehículos
// =====================================================

/**
 * Lista vehículos con paginación.
 * GET /vehiculos
 */
export const getVehiculos = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (usuario?.tipoCuentaId === 5) {
      return res
        .status(403)
        .json({
          error: "No tiene permisos para acceder al módulo de vehículos.",
        });
    }

    const { pagina = 1, limite = 10, buscar } = req.query;

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 10, 1), 100);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    const termino = buscar ? `${buscar}`.trim() : "";
    if (termino) {
      where[Op.or] = [
        { patente: { [Op.like]: `%${termino}%` } },
        { responsable: { [Op.like]: `%${termino}%` } },
      ];
    }

    const { rows, count } = await VehiculoModel.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: limitNumber,
      offset,
    });

    const data = rows.map((row) => buildVehiculoResponse(row));

    return res.json({
      data,
      total: count,
      pagina: pageNumber,
      paginasTotales: Math.ceil(count / limitNumber),
    });
  } catch (error) {
    console.error("Error al obtener vehículos:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los vehículos." });
  }
};

/**
 * Obtiene un vehículo por ID con sus salidas.
 * GET /vehiculos/:id
 */
export const getVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ error: "Debe indicar el vehículo que desea consultar." });
    }

    const vehiculo = await VehiculoModel.findByPk(id, {
      include: [
        {
          model: VehiculoSalidaModel,
          as: "salidas",
          include: vehiculoSalidaIncludes,
        },
      ],
    });

    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado." });
    }

    const respuesta = buildVehiculoResponse(vehiculo);
    respuesta.salidas = (vehiculo.salidas || []).map((salida) =>
      buildVehiculoSalidaResponse(salida)
    );

    return res.json(respuesta);
  } catch (error) {
    console.error("Error al obtener vehículo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener el vehículo." });
  }
};

/**
 * Crea un nuevo vehículo.
 * POST /vehiculos
 */
export const crearVehiculo = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (![1, 2].includes(usuario?.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para crear vehículos." });
    }

    const { patente, responsable, marca, modelo, anio, color, tipo } = req.body;

    const patenteLimpia = normalizarTexto(patente).toUpperCase();
    if (!patenteLimpia || patenteLimpia.length < 5) {
      return res
        .status(400)
        .json({ error: "Debe indicar una patente válida para el vehículo." });
    }

    const existente = await VehiculoModel.findOne({
      where: { patente: patenteLimpia },
    });
    if (existente) {
      return res
        .status(409)
        .json({ error: "Ya existe un vehículo registrado con esa patente." });
    }

    const vehiculo = await VehiculoModel.create({
      patente: patenteLimpia,
      responsable: normalizarTexto(responsable) || null,
      marca: normalizarTexto(marca) || null,
      modelo: normalizarTexto(modelo) || null,
      anio: anio ? parseInt(anio, 10) || null : null,
      color: normalizarTexto(color) || null,
      tipo: normalizarTexto(tipo) || null,
      foto: req.vehiculoFoto?.storageName ?? null,
    });

    await registrarLog(
      usuario.id,
      "CREAR_VEHICULO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { vehiculoId: vehiculo.id }
    );

    return res.status(201).json(buildVehiculoResponse(vehiculo));
  } catch (error) {
    console.error("Error al crear vehículo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al crear el vehículo." });
  }
};

/**
 * Actualiza un vehículo.
 * PUT /vehiculos/:id
 */
export const actualizarVehiculo = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (![1, 2].includes(usuario?.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para actualizar vehículos." });
    }

    const { id } = req.params;
    const vehiculo = await VehiculoModel.findByPk(id);
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado." });
    }

    const {
      patente,
      responsable,
      marca,
      modelo,
      anio,
      color,
      tipo,
      eliminarFoto,
    } = req.body;
    const cambios = {};

    if (typeof patente !== "undefined") {
      const patenteLimpia = normalizarTexto(patente).toUpperCase();
      if (!patenteLimpia || patenteLimpia.length < 5) {
        return res
          .status(400)
          .json({ error: "Debe indicar una patente válida para el vehículo." });
      }
      if (patenteLimpia !== vehiculo.patente) {
        const existente = await VehiculoModel.findOne({
          where: { patente: patenteLimpia, id: { [Op.ne]: vehiculo.id } },
        });
        if (existente) {
          return res
            .status(409)
            .json({
              error: "Ya existe otro vehículo registrado con esa patente.",
            });
        }
      }
      cambios.patente = patenteLimpia;
    }

    if (typeof responsable !== "undefined")
      cambios.responsable = normalizarTexto(responsable) || null;
    if (typeof marca !== "undefined")
      cambios.marca = normalizarTexto(marca) || null;
    if (typeof modelo !== "undefined")
      cambios.modelo = normalizarTexto(modelo) || null;
    if (typeof anio !== "undefined")
      cambios.anio = anio ? parseInt(anio, 10) || null : null;
    if (typeof color !== "undefined")
      cambios.color = normalizarTexto(color) || null;
    if (typeof tipo !== "undefined")
      cambios.tipo = normalizarTexto(tipo) || null;

    if (req.vehiculoFoto?.storageName) {
      cambios.foto = req.vehiculoFoto.storageName;
    } else if (parseBooleanFlag(eliminarFoto, false)) {
      cambios.foto = null;
    }

    if (Object.keys(cambios).length) {
      await vehiculo.update(cambios);
    }

    await registrarLog(
      usuario.id,
      "MODIFICAR_VEHICULO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { vehiculoId: vehiculo.id }
    );

    return res.json(buildVehiculoResponse(vehiculo));
  } catch (error) {
    console.error("Error al actualizar vehículo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el vehículo." });
  }
};

/**
 * Elimina un vehículo.
 * DELETE /vehiculos/:id
 */
export const eliminarVehiculo = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (usuario?.tipoCuentaId !== 1) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para eliminar vehículos." });
    }

    const { id } = req.params;
    const vehiculo = await VehiculoModel.findByPk(id);
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado." });
    }

    await vehiculo.destroy();

    await registrarLog(
      usuario.id,
      "ELIMINAR_VEHICULO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { vehiculoId: id }
    );

    return res.json({ mensaje: "Vehículo eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar vehículo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el vehículo." });
  }
};

// =====================================================
// Endpoints de Salidas de Vehículos
// =====================================================

/**
 * Crea una salida de vehículo.
 * POST /vehiculos/:vehiculoId/salidas
 */
export const crearVehiculoSalida = async (req, res) => {
  try {
    const { vehiculoId } = req.params;
    if (!vehiculoId) {
      return res
        .status(400)
        .json({ error: "Debe indicar un vehículo para registrar la salida." });
    }

    const vehiculo = await VehiculoModel.findByPk(vehiculoId);
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado." });
    }

    const {
      fechaHoraSalida,
      fechaHoraLlegada,
      odometroSalida,
      odometroLlegada,
      cargaCombustible,
      metodoPago,
      valorCarga,
      comentarios,
    } = req.body;

    const salidaDate = parseDateTimeValue(fechaHoraSalida);
    if (!salidaDate) {
      return res
        .status(400)
        .json({ error: "Debe indicar una fecha y hora de salida válidas." });
    }

    const odometroSalidaNumero = parseDecimalValue(odometroSalida);
    if (odometroSalidaNumero === null) {
      return res
        .status(400)
        .json({ error: "Debe indicar un odómetro de salida válido." });
    }

    const llegadaDate = parseDateTimeValue(fechaHoraLlegada);
    const odometroLlegadaNumero =
      odometroLlegada !== undefined &&
      odometroLlegada !== null &&
      odometroLlegada !== ""
        ? parseDecimalValue(odometroLlegada)
        : null;

    if (
      odometroLlegada !== undefined &&
      odometroLlegada !== null &&
      odometroLlegada !== "" &&
      odometroLlegadaNumero === null
    ) {
      return res
        .status(400)
        .json({ error: "El odómetro de llegada indicado no es válido." });
    }

    const combustibleFlag = parseBooleanFlag(cargaCombustible, false);
    const metodoPagoNormalizado = combustibleFlag
      ? normalizarMetodoPagoCombustible(metodoPago)
      : null;

    if (combustibleFlag && !metodoPagoNormalizado) {
      return res
        .status(400)
        .json({
          error:
            "Debe indicar un método de pago válido para la carga de combustible.",
        });
    }

    const valorCargaNumero = combustibleFlag
      ? parseDecimalValue(valorCarga)
      : null;

    const nuevaSalida = await VehiculoSalidaModel.create({
      vehiculoId: vehiculo.id,
      fechaHoraSalida: salidaDate,
      fechaHoraLlegada: llegadaDate,
      odometroSalida: odometroSalidaNumero,
      odometroLlegada: odometroLlegadaNumero,
      cargaCombustible: combustibleFlag,
      metodoPago: combustibleFlag ? metodoPagoNormalizado : null,
      valorCarga: combustibleFlag ? valorCargaNumero : null,
      comentarios: comentarios ? `${comentarios}`.trim() : null,
    });

    const adjuntosGenerales = Array.isArray(req.vehiculoSalidaAdjuntos)
      ? req.vehiculoSalidaAdjuntos
      : [];
    const adjuntosComprobante = Array.isArray(req.vehiculoSalidaComprobante)
      ? req.vehiculoSalidaComprobante
      : [];

    const registrosAdjuntos = [
      ...adjuntosGenerales.map((item) => ({
        vehiculoSalidaId: nuevaSalida.id,
        archivo: item.storageName,
        nombreArchivo: item.originalName,
        mimeType: item.mimeType,
        tipo: "general",
      })),
      ...adjuntosComprobante.map((item) => ({
        vehiculoSalidaId: nuevaSalida.id,
        archivo: item.storageName,
        nombreArchivo: item.originalName,
        mimeType: item.mimeType,
        tipo: "comprobante",
      })),
    ];

    if (registrosAdjuntos.length) {
      await VehiculoSalidaAdjuntoModel.bulkCreate(registrosAdjuntos);
    }

    const tecnicoIds = obtenerTecnicoIdsDesdeBody(req.body);
    if (Array.isArray(tecnicoIds)) {
      await nuevaSalida.setTecnicos(tecnicoIds);
    }

    const detalleSalida = await VehiculoSalidaModel.findByPk(nuevaSalida.id, {
      include: vehiculoSalidaIncludes,
    });

    await registrarLog(
      req.usuario?.id,
      "CREAR_VEHICULO_SALIDA",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { vehiculoId: vehiculo.id, salidaId: nuevaSalida.id }
    );

    return res.status(201).json(buildVehiculoSalidaResponse(detalleSalida));
  } catch (error) {
    console.error("Error al crear salida de vehículo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al registrar la salida del vehículo." });
  }
};

/**
 * Actualiza una salida de vehículo.
 * PUT /vehiculos/:vehiculoId/salidas/:salidaId
 */
export const actualizarVehiculoSalida = async (req, res) => {
  try {
    const { vehiculoId, salidaId } = req.params;
    if (!vehiculoId || !salidaId) {
      return res
        .status(400)
        .json({
          error: "Debe indicar el vehículo y la salida que desea actualizar.",
        });
    }

    const salida = await VehiculoSalidaModel.findOne({
      where: { id: salidaId, vehiculoId },
      include: vehiculoSalidaIncludes,
    });

    if (!salida) {
      return res
        .status(404)
        .json({
          error: "No se encontró la salida indicada para este vehículo.",
        });
    }

    const {
      fechaHoraSalida,
      fechaHoraLlegada,
      odometroSalida,
      odometroLlegada,
      cargaCombustible,
      metodoPago,
      valorCarga,
      comentarios,
      adjuntosEliminar,
    } = req.body;

    if (fechaHoraSalida !== undefined) {
      if (!fechaHoraSalida) {
        return res
          .status(400)
          .json({
            error: "La fecha y hora de salida no pueden quedar vacías.",
          });
      }
      const salidaDate = parseDateTimeValue(fechaHoraSalida);
      if (!salidaDate) {
        return res
          .status(400)
          .json({ error: "Debe indicar una fecha y hora de salida válidas." });
      }
      salida.fechaHoraSalida = salidaDate;
    }

    if (fechaHoraLlegada !== undefined) {
      if (!fechaHoraLlegada) {
        salida.fechaHoraLlegada = null;
      } else {
        const llegadaDate = parseDateTimeValue(fechaHoraLlegada);
        if (!llegadaDate) {
          return res
            .status(400)
            .json({
              error: "La fecha y hora de llegada indicada no es válida.",
            });
        }
        salida.fechaHoraLlegada = llegadaDate;
      }
    }

    if (odometroSalida !== undefined) {
      const odometroSalidaNumero = parseDecimalValue(odometroSalida);
      if (odometroSalidaNumero === null) {
        return res
          .status(400)
          .json({ error: "Debe indicar un odómetro de salida válido." });
      }
      salida.odometroSalida = odometroSalidaNumero;
    }

    if (odometroLlegada !== undefined) {
      if (odometroLlegada === null || odometroLlegada === "") {
        salida.odometroLlegada = null;
      } else {
        const odometroLlegadaNumero = parseDecimalValue(odometroLlegada);
        if (odometroLlegadaNumero === null) {
          return res
            .status(400)
            .json({ error: "El odómetro de llegada indicado no es válido." });
        }
        salida.odometroLlegada = odometroLlegadaNumero;
      }
    }

    if (comentarios !== undefined) {
      salida.comentarios = comentarios ? `${comentarios}`.trim() : null;
    }

    let combustibleFlag = salida.cargaCombustible;
    if (cargaCombustible !== undefined) {
      combustibleFlag = parseBooleanFlag(cargaCombustible, false);
      salida.cargaCombustible = combustibleFlag;
    }

    if (combustibleFlag) {
      if (metodoPago !== undefined) {
        const metodoPagoNormalizado =
          normalizarMetodoPagoCombustible(metodoPago);
        if (!metodoPagoNormalizado) {
          return res
            .status(400)
            .json({
              error:
                "Debe indicar un método de pago válido para la carga de combustible.",
            });
        }
        salida.metodoPago = metodoPagoNormalizado;
      }

      if (valorCarga !== undefined) {
        const valorCargaNumero = parseDecimalValue(valorCarga);
        if (
          valorCarga !== null &&
          valorCarga !== "" &&
          valorCargaNumero === null
        ) {
          return res
            .status(400)
            .json({ error: "El valor de la carga indicado no es válido." });
        }
        salida.valorCarga =
          valorCarga === null || valorCarga === "" ? null : valorCargaNumero;
      }
    } else {
      salida.metodoPago = null;
      salida.valorCarga = null;
    }

    await salida.save();

    const idsAdjuntosEliminar = parseIdArray(adjuntosEliminar);
    if (idsAdjuntosEliminar.length) {
      await VehiculoSalidaAdjuntoModel.destroy({
        where: { id: idsAdjuntosEliminar, vehiculoSalidaId: salida.id },
      });
    }

    const adjuntosGenerales = Array.isArray(req.vehiculoSalidaAdjuntos)
      ? req.vehiculoSalidaAdjuntos
      : [];
    const adjuntosComprobante = Array.isArray(req.vehiculoSalidaComprobante)
      ? req.vehiculoSalidaComprobante
      : [];

    const registrosAdjuntos = [
      ...adjuntosGenerales.map((item) => ({
        vehiculoSalidaId: salida.id,
        archivo: item.storageName,
        nombreArchivo: item.originalName,
        mimeType: item.mimeType,
        tipo: "general",
      })),
      ...adjuntosComprobante.map((item) => ({
        vehiculoSalidaId: salida.id,
        archivo: item.storageName,
        nombreArchivo: item.originalName,
        mimeType: item.mimeType,
        tipo: "comprobante",
      })),
    ];

    if (registrosAdjuntos.length) {
      await VehiculoSalidaAdjuntoModel.bulkCreate(registrosAdjuntos);
    }

    const tecnicoIds = obtenerTecnicoIdsDesdeBody(req.body);
    if (Array.isArray(tecnicoIds)) {
      await salida.setTecnicos(tecnicoIds);
    }

    await salida.reload({ include: vehiculoSalidaIncludes });

    await registrarLog(
      req.usuario?.id,
      "MODIFICAR_VEHICULO_SALIDA",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { vehiculoId, salidaId: salida.id }
    );

    return res.json(buildVehiculoSalidaResponse(salida));
  } catch (error) {
    console.error("Error al actualizar salida de vehículo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar la salida del vehículo." });
  }
};

/**
 * Elimina una salida de vehículo.
 * DELETE /vehiculos/:vehiculoId/salidas/:salidaId
 */
export const eliminarVehiculoSalida = async (req, res) => {
  try {
    const { vehiculoId, salidaId } = req.params;
    if (!vehiculoId || !salidaId) {
      return res
        .status(400)
        .json({
          error: "Debe indicar el vehículo y la salida que desea eliminar.",
        });
    }

    const salida = await VehiculoSalidaModel.findOne({
      where: { id: salidaId, vehiculoId },
    });

    if (!salida) {
      return res
        .status(404)
        .json({
          error: "No se encontró la salida indicada para este vehículo.",
        });
    }

    await salida.destroy();

    await registrarLog(
      req.usuario?.id,
      "ELIMINAR_VEHICULO_SALIDA",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { vehiculoId, salidaId }
    );

    return res.json({ mensaje: "Salida eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar salida de vehículo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar la salida del vehículo." });
  }
};

/**
 * Elimina un adjunto de una salida.
 * DELETE /vehiculos/:vehiculoId/salidas/:salidaId/adjuntos/:adjuntoId
 */
export const eliminarVehiculoSalidaAdjunto = async (req, res) => {
  try {
    const { vehiculoId, salidaId, adjuntoId } = req.params;
    if (!vehiculoId || !salidaId || !adjuntoId) {
      return res
        .status(400)
        .json({
          error:
            "Debe indicar el vehículo, la salida y el adjunto que desea eliminar.",
        });
    }

    const adjunto = await VehiculoSalidaAdjuntoModel.findOne({
      where: { id: adjuntoId, vehiculoSalidaId: salidaId },
      include: [
        {
          model: VehiculoSalidaModel,
          as: "salida",
          attributes: ["id", "vehiculoId"],
        },
      ],
    });

    if (
      !adjunto ||
      adjunto.salida?.vehiculoId !== Number.parseInt(vehiculoId, 10)
    ) {
      return res
        .status(404)
        .json({
          error: "No se encontró el adjunto indicado para esta salida.",
        });
    }

    await adjunto.destroy();

    return res.json({ mensaje: "Adjunto eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar adjunto de salida de vehículo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el adjunto de la salida." });
  }
};
