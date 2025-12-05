/**
 * @fileoverview Controlador de bitácoras y visitas programadas.
 * Maneja CRUD de bitácoras, visitas programadas y asignación de técnicos.
 */

import { Op } from "sequelize";
import {
  BitacoraModel,
  CasaMatrizModel,
  CuentaCasaMatrizModel,
  CuentaModel,
  NotificacionModel,
  ProyectoModel,
  SucursalModel,
  VisitaProgramadaModel,
} from "../models/index.js";
import registrarLog from "../utils/logger.js";
import {
  parseBooleanFlag,
  parseIdArray,
  parseStringArray,
} from "../utils/parsers.js";
import { isValidDateValue } from "../utils/validators.js";
import { construirNotificacionBitacora } from "../utils/builders.js";

// =====================================================
// Includes para queries
// =====================================================

const bitacoraIncludes = [
  {
    model: CasaMatrizModel,
    as: "casaMatriz",
    attributes: ["id", "razonSocial", "rut"],
  },
  {
    model: SucursalModel,
    as: "sucursal",
    attributes: ["id", "sucursal", "estado"],
  },
  {
    model: CuentaModel,
    as: "creadoPor",
    attributes: ["id", "name"],
  },
  {
    model: CuentaModel,
    as: "actualizadoPor",
    attributes: ["id", "name"],
  },
  {
    model: ProyectoModel,
    as: "proyecto",
    attributes: ["id", "nombre"],
  },
];

// =====================================================
// Funciones Helper
// =====================================================

const getAuthorizedClientIds = async (cuentaId) => {
  const rows = await CuentaCasaMatrizModel.findAll({
    where: { cuentaId },
    attributes: ["casaMatrizId"],
    raw: true,
  });
  return rows.map((row) => row.casaMatrizId);
};

const obtenerCuentaIdsPorNombres = async (nombres) => {
  if (!Array.isArray(nombres) || nombres.length === 0) return [];
  const normalizados = Array.from(
    new Set(
      nombres.map((item) => `${item}`.trim()).filter((item) => item.length > 0)
    )
  );
  if (!normalizados.length) return [];
  const cuentas = await CuentaModel.findAll({
    where: { name: { [Op.in]: normalizados } },
    attributes: ["id", "name"],
  });
  return cuentas.map((cuenta) => cuenta.id);
};

const extraerIdsTecnicosAsignacion = async (body, tecnicosNombres) => {
  const idsEntrada = parseIdArray(
    body?.tecnicosIds ??
      body?.tecnicoIds ??
      body?.tecnicosId ??
      body?.tecnicoId ??
      []
  );
  if (idsEntrada.length > 0) {
    return Array.from(
      new Set(idsEntrada.filter((id) => Number.isInteger(id) && id > 0))
    );
  }
  return obtenerCuentaIdsPorNombres(tecnicosNombres);
};

const crearNotificacionesAsignacionBitacora = async (
  bitacora,
  cuentaIds,
  asignadoPorId
) => {
  if (!bitacora || !Array.isArray(cuentaIds) || cuentaIds.length === 0) return;
  const idsUnicos = Array.from(
    new Set(cuentaIds.filter((id) => Number.isInteger(id) && id > 0))
  );
  if (!idsUnicos.length) return;

  const datos = construirNotificacionBitacora(bitacora);
  const referenciaTipo = "bitacora";
  const ahora = new Date();

  await Promise.all(
    idsUnicos.map(async (cuentaId) => {
      const [registro, creado] = await NotificacionModel.findOrCreate({
        where: { cuentaId, referenciaId: bitacora.id, referenciaTipo },
        defaults: {
          cuentaId,
          tipo: referenciaTipo,
          titulo: datos.titulo,
          mensaje: datos.mensaje,
          referenciaId: bitacora.id,
          referenciaTipo,
          metadata: { ...datos.metadata, asignadoPorId },
          leida: false,
          createdAt: ahora,
          updatedAt: ahora,
        },
      });
      if (!creado) {
        await registro.update({
          titulo: datos.titulo,
          mensaje: datos.mensaje,
          metadata: { ...datos.metadata, asignadoPorId },
          leida: false,
          updatedAt: ahora,
        });
      }
    })
  );
};

const normalizarNombreTecnico = (valor) => {
  if (typeof valor !== "string") return "";
  return valor.trim().toLowerCase();
};

// =====================================================
// Endpoints
// =====================================================

/**
 * Lista bitácoras con paginación y filtros.
 * GET /bitacoras
 */
export const getBitacoras = async (req, res) => {
  try {
    const usuario = req.usuario;
    const {
      pagina = 1,
      limite = 10,
      clienteId,
      sucursalId,
      buscar,
      proyectoId,
      sinProyecto,
    } = req.query;

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limite, 10) || 10, 1);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    const esCliente = usuario && usuario.tipoCuentaId === 4;

    if (clienteId) where.casaMatrizId = clienteId;
    if (sucursalId) where.sucursalId = sucursalId;

    const terminoBusqueda = buscar ? `${buscar}`.trim() : "";
    if (terminoBusqueda) {
      where[Op.or] = [
        { titulo: { [Op.like]: `%${terminoBusqueda}%` } },
        { descripcion: { [Op.like]: `%${terminoBusqueda}%` } },
      ];
    }

    const proyectoIdValor =
      typeof proyectoId === "string" ? proyectoId.trim() : proyectoId;
    if (
      proyectoIdValor !== undefined &&
      proyectoIdValor !== null &&
      `${proyectoIdValor}`.trim() !== ""
    ) {
      const proyectoIdNumero = Number.parseInt(`${proyectoIdValor}`, 10);
      if (!Number.isInteger(proyectoIdNumero) || proyectoIdNumero <= 0) {
        return res
          .status(400)
          .json({
            error: "El identificador del proyecto indicado no es valido.",
          });
      }
      where.proyectoId = proyectoIdNumero;
    } else if (parseBooleanFlag(sinProyecto, false)) {
      where.proyectoId = null;
    }

    if (esCliente) {
      const autorizados = await getAuthorizedClientIds(usuario.id);
      if (autorizados.length === 0) {
        return res.json({
          data: [],
          total: 0,
          pagina: pageNumber,
          paginasTotales: 0,
        });
      }
      if (clienteId && !autorizados.includes(clienteId)) {
        return res
          .status(403)
          .json({
            error: "No tiene permisos para ver las bitacoras de este cliente.",
          });
      }
      if (!clienteId) {
        where.casaMatrizId = { [Op.in]: autorizados };
      }
    }

    const { rows, count } = await BitacoraModel.findAndCountAll({
      where,
      include: bitacoraIncludes,
      order: [
        ["fechaVisita", "DESC"],
        ["horaLlegada", "DESC"],
      ],
      limit: limitNumber,
      offset,
    });

    const data = rows.map((row) => row.toJSON());
    return res.json({
      data,
      total: count,
      pagina: pageNumber,
      paginasTotales: Math.ceil(count / limitNumber),
    });
  } catch (error) {
    console.error("Error al obtener bitacoras:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener las bitacoras." });
  }
};

/**
 * Obtiene una bitácora por ID.
 * GET /bitacoras/:id
 */
export const getBitacoraById = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;

    const bitacora = await BitacoraModel.findByPk(id, {
      include: bitacoraIncludes,
    });

    if (!bitacora) {
      return res.status(404).json({ error: "Bitacora no encontrada." });
    }

    if (usuario.tipoCuentaId === 4) {
      const autorizados = await getAuthorizedClientIds(usuario.id);
      if (!autorizados.includes(bitacora.casaMatrizId)) {
        return res
          .status(403)
          .json({
            error: "No tiene permisos para ver la bitacora solicitada.",
          });
      }
    }

    return res.json(bitacora);
  } catch (error) {
    console.error("Error al obtener la bitacora:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener la bitacora." });
  }
};

/**
 * Crea una nueva bitácora.
 * POST /bitacoras
 */
export const crearBitacora = async (req, res) => {
  try {
    const usuario = req.usuario;

    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para crear bitacoras." });
    }

    let bodyData = req.body;
    if (req.body && req.body.payload) {
      try {
        bodyData = JSON.parse(req.body.payload);
      } catch (err) {
        bodyData = req.body;
      }
    }

    const {
      casaMatrizId,
      sucursalId,
      fechaVisita,
      horaLlegada,
      horaSalida,
      tecnicos,
      descripcion,
      titulo,
      isEmergencia,
      proyectoId,
    } = bodyData;

    if (!casaMatrizId || !fechaVisita) {
      return res
        .status(400)
        .json({
          error: "Los campos casaMatrizId y fechaVisita son obligatorios.",
        });
    }

    if (!isValidDateValue(fechaVisita)) {
      return res
        .status(400)
        .json({ error: "La fecha de la visita no es valida." });
    }

    const descripcionLimpia = descripcion ? `${descripcion}`.trim() : "";
    if (!descripcionLimpia) {
      return res
        .status(400)
        .json({ error: "La nota de la bitacora no puede estar vacia." });
    }

    let llegadaDate = null;
    if (horaLlegada) {
      if (!isValidDateValue(horaLlegada)) {
        return res
          .status(400)
          .json({ error: "La hora de llegada debe tener un formato valido." });
      }
      llegadaDate = new Date(horaLlegada);
    }

    let salidaDate = null;
    if (horaSalida) {
      if (!isValidDateValue(horaSalida)) {
        return res
          .status(400)
          .json({ error: "La hora de salida debe tener un formato valido." });
      }
      salidaDate = new Date(horaSalida);
    }

    const cliente = await CasaMatrizModel.findByPk(casaMatrizId);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    let sucursal = null;
    if (sucursalId) {
      sucursal = await SucursalModel.findByPk(sucursalId);
      if (!sucursal) {
        return res.status(404).json({ error: "Sucursal no encontrada." });
      }
      if (sucursal.casaMatrizId !== casaMatrizId) {
        return res
          .status(400)
          .json({
            error: "La sucursal seleccionada no pertenece al cliente indicado.",
          });
      }
    }

    let proyectoSeleccionado = null;
    if (
      typeof proyectoId !== "undefined" &&
      proyectoId !== null &&
      `${proyectoId}`.trim() !== "" &&
      `${proyectoId}`.trim().toLowerCase() !== "null"
    ) {
      const proyectoIdNumero = Number.parseInt(`${proyectoId}`, 10);
      if (!Number.isInteger(proyectoIdNumero) || proyectoIdNumero <= 0) {
        return res
          .status(400)
          .json({ error: "El proyecto indicado no es valido." });
      }
      proyectoSeleccionado = await ProyectoModel.findByPk(proyectoIdNumero);
      if (!proyectoSeleccionado) {
        return res.status(404).json({ error: "Proyecto no encontrado." });
      }
    }

    const tecnicosArray = parseStringArray(tecnicos);
    if (tecnicosArray.length === 0) {
      return res
        .status(400)
        .json({
          error: "Debe indicar al menos un tecnico responsable de la visita.",
        });
    }

    const tecnicosIdsAsignados = await extraerIdsTecnicosAsignacion(
      bodyData,
      tecnicosArray
    );

    if (llegadaDate && salidaDate && salidaDate < llegadaDate) {
      return res
        .status(400)
        .json({
          error: "La hora de salida debe ser posterior a la hora de llegada.",
        });
    }

    const nuevaBitacora = await BitacoraModel.create({
      casaMatrizId,
      sucursalId: sucursal ? sucursal.id : null,
      fechaVisita,
      horaLlegada: llegadaDate,
      horaSalida: salidaDate,
      tecnicos: tecnicosArray,
      descripcion: descripcionLimpia,
      titulo: titulo ? `${titulo}`.trim() || null : null,
      creadoPorId: usuario.id,
      actualizadoPorId: usuario.id,
      proyectoId: proyectoSeleccionado ? proyectoSeleccionado.id : null,
      isEmergencia: parseBooleanFlag(isEmergencia, false),
      adjuntos: Array.isArray(req.uploadedFiles) ? req.uploadedFiles : [],
      adjuntosTermino: Array.isArray(req.uploadedEvidenceFiles)
        ? req.uploadedEvidenceFiles
        : [],
    });

    const bitacoraCreada = await BitacoraModel.findByPk(nuevaBitacora.id, {
      include: bitacoraIncludes,
    });

    await crearNotificacionesAsignacionBitacora(
      bitacoraCreada,
      tecnicosIdsAsignados,
      usuario.id
    );

    return res.status(201).json(bitacoraCreada);
  } catch (error) {
    console.error("Error al crear bitacora:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al crear la bitacora." });
  }
};

/**
 * Actualiza una bitácora.
 * PUT /bitacoras/:id
 */
export const actualizarBitacora = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;

    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para modificar bitacoras." });
    }

    const bitacora = await BitacoraModel.findByPk(id);
    if (!bitacora) {
      return res.status(404).json({ error: "Bitacora no encontrada." });
    }

    const tecnicosPrevios = Array.isArray(bitacora.tecnicos)
      ? bitacora.tecnicos
          .map((item) => `${item}`.trim())
          .filter((item) => item.length > 0)
      : [];
    let idsAsignacionEntrada = null;

    let bodyData = req.body;
    if (req.body && req.body.payload) {
      try {
        bodyData = JSON.parse(req.body.payload);
      } catch (err) {
        bodyData = req.body;
      }
    }

    const {
      casaMatrizId,
      sucursalId,
      fechaVisita,
      horaLlegada,
      horaSalida,
      tecnicos,
      descripcion,
      titulo,
      isEmergencia,
    } = bodyData;

    let proyectoCambioSolicitado = false;
    let proyectoIdFinal = bitacora.proyectoId;

    if (Object.prototype.hasOwnProperty.call(bodyData, "proyectoId")) {
      proyectoCambioSolicitado = true;
      const rawProyectoId = bodyData.proyectoId;
      if (
        rawProyectoId === null ||
        rawProyectoId === undefined ||
        `${rawProyectoId}`.trim() === "" ||
        `${rawProyectoId}`.trim().toLowerCase() === "null"
      ) {
        proyectoIdFinal = null;
      } else {
        const proyectoIdNumero = Number.parseInt(`${rawProyectoId}`, 10);
        if (!Number.isInteger(proyectoIdNumero) || proyectoIdNumero <= 0) {
          return res
            .status(400)
            .json({ error: "El proyecto indicado no es valido." });
        }
        const proyectoSeleccionado = await ProyectoModel.findByPk(
          proyectoIdNumero
        );
        if (!proyectoSeleccionado) {
          return res.status(404).json({ error: "Proyecto no encontrado." });
        }
        proyectoIdFinal = proyectoSeleccionado.id;
      }
    }

    const cambios = {};

    if (usuario.tipoCuentaId === 2) {
      const descripcionDefinida = typeof descripcion !== "undefined";
      if (!descripcionDefinida && !proyectoCambioSolicitado) {
        return res
          .status(400)
          .json({
            error: "El tecnico solo puede modificar la nota de la bitacora.",
          });
      }
      if (descripcionDefinida) {
        const descripcionLimpia = `${descripcion ?? ""}`.trim();
        if (!descripcionLimpia) {
          return res
            .status(400)
            .json({ error: "La nota de la bitacora no puede estar vacia." });
        }
        cambios.descripcion = descripcionLimpia;
      }
    } else if (usuario.tipoCuentaId === 1) {
      if (typeof descripcion !== "undefined") {
        const descripcionLimpia = `${descripcion ?? ""}`.trim();
        if (!descripcionLimpia) {
          return res
            .status(400)
            .json({ error: "La nota de la bitacora no puede estar vacia." });
        }
        cambios.descripcion = descripcionLimpia;
      }

      if (typeof titulo !== "undefined") {
        const tituloLimpio = `${titulo ?? ""}`.trim();
        cambios.titulo = tituloLimpio.length > 0 ? tituloLimpio : null;
      }

      if (typeof casaMatrizId !== "undefined") {
        if (!casaMatrizId) {
          return res
            .status(400)
            .json({
              error: "El cliente de la bitacora no puede quedar vacio.",
            });
        }
        const cliente = await CasaMatrizModel.findByPk(casaMatrizId);
        if (!cliente) {
          return res.status(404).json({ error: "Cliente no encontrado." });
        }
        cambios.casaMatrizId = casaMatrizId;
      }

      if (typeof fechaVisita !== "undefined") {
        if (!isValidDateValue(fechaVisita)) {
          return res
            .status(400)
            .json({ error: "La fecha de la visita no es valida." });
        }
        cambios.fechaVisita = fechaVisita;
      }

      if (typeof horaLlegada !== "undefined") {
        if (!horaLlegada) {
          cambios.horaLlegada = null;
        } else {
          if (!isValidDateValue(horaLlegada)) {
            return res
              .status(400)
              .json({
                error: "La hora de llegada debe tener un formato valido.",
              });
          }
          cambios.horaLlegada = new Date(horaLlegada);
        }
      }

      if (typeof horaSalida !== "undefined") {
        if (!horaSalida) {
          cambios.horaSalida = null;
        } else {
          if (!isValidDateValue(horaSalida)) {
            return res
              .status(400)
              .json({
                error: "La hora de salida debe tener un formato valido.",
              });
          }
          cambios.horaSalida = new Date(horaSalida);
        }
      }

      if (typeof tecnicos !== "undefined") {
        const tecnicosArray = parseStringArray(tecnicos);
        if (tecnicosArray.length === 0) {
          return res
            .status(400)
            .json({
              error:
                "Debe indicar al menos un tecnico responsable de la visita.",
            });
        }
        cambios.tecnicos = tecnicosArray;
        idsAsignacionEntrada = await extraerIdsTecnicosAsignacion(
          bodyData,
          tecnicosArray
        );
      }

      if (typeof isEmergencia !== "undefined") {
        cambios.isEmergencia = parseBooleanFlag(
          isEmergencia,
          bitacora.isEmergencia
        );
      }

      if (typeof sucursalId !== "undefined") {
        if (!sucursalId) {
          cambios.sucursalId = null;
        } else {
          const sucursal = await SucursalModel.findByPk(sucursalId);
          if (!sucursal) {
            return res.status(404).json({ error: "Sucursal no encontrada." });
          }
          const clienteDestino = cambios.casaMatrizId ?? bitacora.casaMatrizId;
          if (sucursal.casaMatrizId !== clienteDestino) {
            return res
              .status(400)
              .json({
                error:
                  "La sucursal seleccionada no pertenece al cliente indicado.",
              });
          }
          cambios.sucursalId = sucursalId;
        }
      }
    }

    if (proyectoCambioSolicitado) {
      cambios.proyectoId = proyectoIdFinal;
    }

    const tieneCambio = (campo) =>
      Object.prototype.hasOwnProperty.call(cambios, campo);

    const horaLlegadaFinal = tieneCambio("horaLlegada")
      ? cambios.horaLlegada
      : bitacora.horaLlegada;
    const horaSalidaFinal = tieneCambio("horaSalida")
      ? cambios.horaSalida
      : bitacora.horaSalida;

    const llegadaDateFinal = horaLlegadaFinal
      ? new Date(horaLlegadaFinal)
      : null;
    const salidaDateFinal = horaSalidaFinal ? new Date(horaSalidaFinal) : null;

    if (!llegadaDateFinal || !salidaDateFinal) {
      return res
        .status(400)
        .json({
          error:
            "Las horas de llegada y salida son obligatorias para bitacoras.",
        });
    }
    if (salidaDateFinal <= llegadaDateFinal) {
      return res
        .status(400)
        .json({
          error: "La hora de salida debe ser posterior a la hora de llegada.",
        });
    }

    if (Object.keys(cambios).length === 0) {
      const current = await BitacoraModel.findByPk(id, {
        include: bitacoraIncludes,
      });
      return res.json(current);
    }

    cambios.actualizadoPorId = usuario.id;
    await bitacora.update(cambios);

    const nuevosAdjuntos = Array.isArray(req.uploadedFiles)
      ? req.uploadedFiles
      : [];
    const nuevosAdjuntosEvidencia = Array.isArray(req.uploadedEvidenceFiles)
      ? req.uploadedEvidenceFiles
      : [];

    if (nuevosAdjuntos.length || nuevosAdjuntosEvidencia.length) {
      try {
        if (nuevosAdjuntos.length) {
          const actuales = Array.isArray(bitacora.adjuntos)
            ? bitacora.adjuntos
            : [];
          bitacora.adjuntos = actuales.concat(nuevosAdjuntos);
        }
        if (nuevosAdjuntosEvidencia.length) {
          const actualesEvidencia = Array.isArray(bitacora.adjuntosTermino)
            ? bitacora.adjuntosTermino
            : [];
          bitacora.adjuntosTermino = actualesEvidencia.concat(
            nuevosAdjuntosEvidencia
          );
        }
        await bitacora.save();
      } catch (err) {
        console.error("Error al anexar adjuntos a bitacora:", err);
      }
    }

    await bitacora.reload({ include: bitacoraIncludes });

    let nuevosIdsNotificacion = [];
    if (Array.isArray(idsAsignacionEntrada) && idsAsignacionEntrada.length) {
      const idsPrevios =
        tecnicosPrevios.length > 0
          ? await obtenerCuentaIdsPorNombres(tecnicosPrevios)
          : [];
      nuevosIdsNotificacion = idsAsignacionEntrada.filter(
        (id) => !idsPrevios.includes(id)
      );
    } else if (Object.prototype.hasOwnProperty.call(cambios, "tecnicos")) {
      const previosSet = new Set(
        tecnicosPrevios.map((nombre) => normalizarNombreTecnico(nombre))
      );
      const actualesSet = new Set(
        (Array.isArray(bitacora.tecnicos) ? bitacora.tecnicos : []).map(
          (nombre) => normalizarNombreTecnico(nombre)
        )
      );
      const nuevosNombres = Array.from(actualesSet).filter(
        (nombre) => !previosSet.has(nombre)
      );
      if (nuevosNombres.length) {
        nuevosIdsNotificacion = await obtenerCuentaIdsPorNombres(nuevosNombres);
      }
    }

    if (nuevosIdsNotificacion.length) {
      await crearNotificacionesAsignacionBitacora(
        bitacora,
        nuevosIdsNotificacion,
        usuario.id
      );
    }

    // LOG
    await registrarLog(
      usuario.id,
      "MODIFICAR_BITACORA",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { bitacoraId: bitacora.id }
    );

    return res.json(bitacora);
  } catch (error) {
    console.error("Error al actualizar bitacora:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar la bitacora." });
  }
};

/**
 * Elimina una bitácora.
 * DELETE /bitacoras/:id
 */
export const eliminarBitacora = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;

    if (usuario.tipoCuentaId !== 1) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para eliminar bitacoras." });
    }

    const bitacora = await BitacoraModel.findByPk(id);
    if (!bitacora) {
      return res.status(404).json({ error: "Bitacora no encontrada." });
    }

    await bitacora.destroy();

    // LOG
    await registrarLog(
      usuario.id,
      "ELIMINAR_BITACORA",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { bitacoraId: id }
    );

    return res.json({ mensaje: "Bitacora eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar bitacora:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar la bitacora." });
  }
};

// =====================================================
// Visitas Programadas
// =====================================================

/**
 * Obtiene visitas programadas.
 * GET /visitas-programadas
 */
export const getVisitasProgramadas = async (req, res) => {
  try {
    const usuario = req.usuario;
    const where = {};

    if (usuario.tipoCuentaId === 4) {
      const autorizados =
        req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
      req.autorizados = autorizados;
      if (!autorizados.length) {
        return res.json([]);
      }
      where.casaMatrizId = { [Op.in]: autorizados };
    }

    const visitas = await VisitaProgramadaModel.findAll({
      where,
      include: [
        {
          model: CasaMatrizModel,
          as: "casaMatriz",
          attributes: ["id", "razonSocial", "rut"],
        },
        {
          model: SucursalModel,
          as: "sucursal",
          attributes: ["id", "sucursal", "estado"],
        },
      ],
      order: [
        ["fechaProgramada", "ASC"],
        ["horaLlegada", "ASC"],
      ],
    });

    return res.json(visitas);
  } catch (error) {
    console.error("Error al obtener visitas programadas:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener las visitas programadas." });
  }
};

/**
 * Crea una visita programada.
 * POST /visitas-programadas
 */
export const crearVisitaProgramada = async (req, res) => {
  try {
    const usuario = req.usuario;

    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para agendar visitas." });
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
      casaMatrizId,
      sucursalId,
      fechaProgramada,
      horaLlegada,
      horaSalida,
      tecnicos,
      descripcion,
      titulo,
    } = bodyData;

    if (!casaMatrizId || !fechaProgramada) {
      return res
        .status(400)
        .json({
          error: "Los campos casaMatrizId y fechaProgramada son obligatorios.",
        });
    }

    const descripcionLimpia = descripcion ? `${descripcion}`.trim() : "";
    if (!descripcionLimpia) {
      return res
        .status(400)
        .json({ error: "La descripcion de la visita no puede estar vacia." });
    }

    if (!isValidDateValue(fechaProgramada)) {
      return res
        .status(400)
        .json({ error: "La fecha programada no es valida." });
    }

    let llegadaDate = null;
    let salidaDate = null;

    if (horaLlegada) {
      if (!isValidDateValue(horaLlegada)) {
        return res
          .status(400)
          .json({ error: "La hora de llegada debe tener un formato valido." });
      }
      llegadaDate = new Date(horaLlegada);
    }

    if (horaSalida) {
      if (!isValidDateValue(horaSalida)) {
        return res
          .status(400)
          .json({ error: "La hora de salida debe tener un formato valido." });
      }
      salidaDate = new Date(horaSalida);
    }

    if (llegadaDate && salidaDate && salidaDate <= llegadaDate) {
      return res
        .status(400)
        .json({
          error: "La hora de salida debe ser posterior a la hora de llegada.",
        });
    }

    const cliente = await CasaMatrizModel.findByPk(casaMatrizId);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    let sucursal = null;
    if (sucursalId) {
      sucursal = await SucursalModel.findByPk(sucursalId);
      if (!sucursal) {
        return res.status(404).json({ error: "Sucursal no encontrada." });
      }
      if (sucursal.casaMatrizId !== casaMatrizId) {
        return res
          .status(400)
          .json({
            error: "La sucursal seleccionada no pertenece al cliente indicado.",
          });
      }
    }

    const tecnicosArray = parseStringArray(tecnicos);
    if (tecnicosArray.length === 0) {
      return res
        .status(400)
        .json({
          error: "Debe indicar al menos un tecnico responsable de la visita.",
        });
    }

    const nuevaVisita = await VisitaProgramadaModel.create({
      casaMatrizId,
      sucursalId: sucursal ? sucursal.id : null,
      fechaProgramada,
      horaLlegada: llegadaDate,
      horaSalida: salidaDate,
      tecnicos: tecnicosArray,
      descripcion: descripcionLimpia,
      titulo: titulo ? `${titulo}`.trim() || null : null,
      creadoPorId: usuario.id,
      actualizadoPorId: usuario.id,
      estado: "pendiente",
    });

    const visitaCreada = await VisitaProgramadaModel.findByPk(nuevaVisita.id, {
      include: [
        { model: CasaMatrizModel, as: "casaMatriz" },
        { model: SucursalModel, as: "sucursal" },
      ],
    });

    // LOG
    await registrarLog(
      usuario.id,
      "CREAR_VISITA_PROGRAMADA",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { visitaId: nuevaVisita.id, clienteId: casaMatrizId }
    );

    return res.status(201).json(visitaCreada);
  } catch (error) {
    console.error("Error al agendar visita:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al agendar la visita." });
  }
};

/**
 * Elimina una visita programada.
 * DELETE /visitas-programadas/:id
 */
export const eliminarVisitaProgramada = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;

    if (usuario.tipoCuentaId !== 1) {
      return res
        .status(403)
        .json({
          error: "No tiene permisos para eliminar visitas programadas.",
        });
    }

    const visita = await VisitaProgramadaModel.findByPk(id);
    if (!visita) {
      return res
        .status(404)
        .json({ error: "Visita programada no encontrada." });
    }

    await visita.destroy();

    // LOG
    await registrarLog(
      usuario.id,
      "ELIMINAR_VISITA_PROGRAMADA",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { visitaId: id }
    );

    return res.json({ mensaje: "Visita programada eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar visita programada:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar la visita programada." });
  }
};
