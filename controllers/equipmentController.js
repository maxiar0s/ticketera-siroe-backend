/**
 * @fileoverview Controlador de equipos.
 * Maneja CRUD de equipos, tipos de equipo, campos y departamentos.
 */

import { col, fn, Op, where as sqlWhere } from "sequelize";
import db from "../config/db.js";
import {
  CampoModel,
  CasaMatrizModel,
  CuentaCasaMatrizModel,
  DepartamentoEquipoModel,
  EquipoModel,
  EstadoEquipoModel,
  ObservacionModel,
  SucursalModel,
  TipoEquipoCampoModel,
  TipoEquipoModel,
} from "../models/index.js";
import registrarLog from "../utils/logger.js";
import { parseBooleanFlag, parseStringArray } from "../utils/parsers.js";
import {
  normalizarTexto,
  normalizarCodigo,
  normalizarColorCriticidad,
  formatearNombreCampo,
} from "../utils/validators.js";

/**
 * Helper: Obtiene IDs de clientes autorizados para una cuenta.
 */
const getAuthorizedClientIds = async (cuentaId) => {
  const rows = await CuentaCasaMatrizModel.findAll({
    where: { cuentaId },
    attributes: ["casaMatrizId"],
    raw: true,
  });
  return rows.map((row) => row.casaMatrizId);
};

// =====================================================
// Funciones Helper Internas
// =====================================================

const parseJsonFlexible = (valor) => {
  if (valor === null || valor === undefined) return undefined;
  if (Array.isArray(valor)) return valor;
  if (typeof valor === "string") {
    const trimmed = valor.trim();
    if (!trimmed.length) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (_error) {
      return [];
    }
  }
  return [];
};

const parseValorComparable = (valor) => {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") {
    const trimmed = valor.trim();
    if (!trimmed.length) return null;
    const numero = Number(trimmed);
    return Number.isNaN(numero) ? trimmed : numero;
  }
  if (typeof valor === "boolean") return valor;
  return null;
};

const parsePresetOptions = (rawValue) => {
  const lista = parseJsonFlexible(rawValue);
  if (!Array.isArray(lista)) return [];

  return lista
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const label = normalizarTexto(item.label);
      const value =
        item.value !== undefined && item.value !== null
          ? normalizarTexto(`${item.value}`)
          : "";
      if (!label || !value) return null;
      const color = normalizarColorCriticidad(item.color, "amarillo");
      return { label, value, color };
    })
    .filter((item) => item !== null);
};

const parseStandards = (rawValue) => {
  const lista = parseJsonFlexible(rawValue);
  if (!Array.isArray(lista)) return [];

  return lista
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const label = normalizarTexto(item.label);
      const description = normalizarTexto(item.description);
      const color = normalizarColorCriticidad(item.color, "amarillo");
      const operator = normalizarTexto(item.operator).toLowerCase();
      const value = parseValorComparable(
        Object.prototype.hasOwnProperty.call(item, "value") ? item.value : null
      );
      const secondaryValue = parseValorComparable(
        Object.prototype.hasOwnProperty.call(item, "secondaryValue")
          ? item.secondaryValue
          : null
      );
      const unit = normalizarTexto(item.unit);
      const etiqueta = label || description;
      if (!etiqueta) return null;

      const regla = { color, label: etiqueta };
      if (description) regla.description = description;
      if (operator) regla.operator = operator;
      if (value !== null) regla.value = value;
      if (secondaryValue !== null) regla.secondaryValue = secondaryValue;
      if (unit) regla.unit = unit;
      return regla;
    })
    .filter((item) => item !== null);
};

const obtenerTipoEquipoPorId = async (id) => {
  if (!id) return null;
  const parsed = Number.parseInt(`${id}`, 10);
  if (Number.isNaN(parsed)) return null;
  return await TipoEquipoModel.findByPk(parsed);
};

const obtenerCampoIdsNormalizados = (campoIds) => {
  if (!Array.isArray(campoIds)) return [];
  const ids = campoIds
    .map((valor) => {
      const parsed = Number.parseInt(`${valor}`, 10);
      return Number.isNaN(parsed) ? null : parsed;
    })
    .filter((valor) => valor !== null && valor > 0);
  return Array.from(new Set(ids));
};

// =====================================================
// Endpoints de Equipos
// =====================================================

/**
 * Crea un nuevo equipo.
 * POST /ingresar-equipo
 */
export const postEquipo = async (req, res) => {
  const {
    clienteId = null,
    sucursalId = null,
    departamento,
    departamentoId,
    tipoEquipoId,
  } = req.body;

  if (!clienteId && !sucursalId) {
    return res
      .status(400)
      .json({ error: "Debe proporcionar un clienteId o sucursalId" });
  }

  let imagenName = null;
  if (req.uploadedFile) {
    imagenName = req.uploadedFile;
    if (
      !imagenName ||
      typeof imagenName !== "string" ||
      imagenName.trim() === ""
    ) {
      return res
        .status(400)
        .json({
          error: "Error al subir la imagen. Nombre de archivo inválido.",
        });
    }
  }

  const t = await db.transaction();

  try {
    let departamentoNombre = normalizarTexto(departamento);

    if (
      departamentoId !== undefined &&
      departamentoId !== null &&
      `${departamentoId}`.trim() !== ""
    ) {
      const parsedDepartamentoId = Number.parseInt(
        `${departamentoId}`.trim(),
        10
      );
      if (Number.isNaN(parsedDepartamentoId)) {
        throw new Error("Identificador de departamento inválido.");
      }
      const registroDepartamento = await DepartamentoEquipoModel.findByPk(
        parsedDepartamentoId,
        { transaction: t }
      );
      if (!registroDepartamento) {
        throw new Error("El departamento seleccionado no existe.");
      }
      departamentoNombre = registroDepartamento.name;
    }

    if (!departamentoNombre) {
      throw new Error("Debe seleccionar un departamento válido.");
    }

    const lockCondition = sucursalId ? { sucursalId } : { clienteId };

    const ultimoEquipo = await EquipoModel.findOne({
      where: lockCondition,
      order: [["numeroSecuencial", "DESC"]],
      lock: true,
      skipLocked: false,
      transaction: t,
    });

    const maxNumero = ultimoEquipo ? ultimoEquipo.numeroSecuencial : 0;
    const nextNumero = maxNumero + 1;

    const tipoEquipo = await TipoEquipoModel.findOne({
      where: { id: tipoEquipoId },
      transaction: t,
    });

    if (!tipoEquipo) {
      throw new Error("El tipo de equipo no existe");
    }

    const deptCode = departamentoNombre.substring(0, 4).toUpperCase();
    const numeroPadded = nextNumero.toString().padStart(3, "0");
    const codigoId = `SI${deptCode}${tipoEquipo.dict}${numeroPadded}`;

    const equipoData = {
      numeroSecuencial: nextNumero,
      casaMatrizId: null,
      clienteId,
      sucursalId,
      estado: 1,
      marca: req.body.marca || null,
      modelo: req.body.modelo || null,
      codigoId,
      departamento: departamentoNombre,
      numeroSerie: req.body.numeroSerie || null,
      procesador: req.body.procesador || null,
      velocidadProcesador: req.body.velocidadProcesador || null,
      ram: req.body.ram || null,
      tipoAlmacenamiento: req.body.tipoAlmacenamiento || null,
      cantidadAlmacenamiento: req.body.cantidadAlmacenamiento || null,
      sistemaOperativo: req.body.sistemaOperativo || null,
      ofimatica: req.body.ofimatica || null,
      antivirus: req.body.antivirus || null,
      tipoEquipoId: tipoEquipo.id,
      esArriendo: parseBooleanFlag(req.body.esArriendo),
    };
    if (imagenName) {
      equipoData.imagen = imagenName;
    }

    const nuevoEquipo = await EquipoModel.create(equipoData, {
      transaction: t,
    });

    await t.commit();

    await registrarLog(
      req.usuario?.id,
      "CREAR_EQUIPO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { equipoId: nuevoEquipo.id, codigoId: nuevoEquipo.codigoId }
    );

    return res.json({
      message: "Equipo creado satisfactoriamente",
      nuevoEquipo,
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error(error);
    if (error instanceof Error && typeof error.message === "string") {
      const mensaje = error.message;
      if (
        mensaje.includes("departamento") ||
        mensaje.includes("Identificador de departamento") ||
        mensaje.includes("Debe seleccionar un departamento")
      ) {
        return res.status(400).json({ error: mensaje });
      }
    }
    return res
      .status(500)
      .json({ error: "Error al crear el equipo", details: error.message });
  }
};

/**
 * Agrega una observación a un equipo.
 * POST /ingresar-observacion/:id
 */
export const postObservacion = async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const usuario = req.usuario;
  if (usuario && usuario.tipoCuentaId === 4) {
    return res
      .status(403)
      .json({ error: "No tiene permisos para agregar observaciones." });
  }

  const observacion = await ObservacionModel.create({
    text,
    equipoId: id,
  });

  return res.json(observacion);
};

/**
 * Modifica un equipo existente.
 * POST /modificar-equipo/:id
 */
export const postModificarEquipo = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .json({ resp: "Error al intentar modificar el equipo" });
  }

  try {
    const equipo = await EquipoModel.findByPk(id);

    if (!equipo) {
      return res
        .status(404)
        .json({ resp: "Equipo no encontrado, intente nuevamente" });
    }

    const {
      marca,
      modelo,
      numeroSerie,
      usuario,
      procesador,
      velocidadProcesador,
      ram,
      tipoAlmacenamiento,
      cantidadAlmacenamiento,
      sistemaOperativo,
      ofimatica,
      antivirus,
      departamento: departamentoTexto,
      departamentoId,
      esArriendo,
    } = req.body;

    const limpiarCadena = (valor) => {
      if (valor === undefined) return undefined;
      if (valor === null) return null;
      if (typeof valor !== "string") return valor;
      const trimmed = valor.trim();
      if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
      return trimmed;
    };

    const limpiarEntero = (valor) => {
      const limpio = limpiarCadena(valor);
      if (limpio === undefined || limpio === null)
        return limpio === undefined ? undefined : null;
      const numero = parseInt(limpio, 10);
      return Number.isNaN(numero) ? null : numero;
    };

    const datosActualizados = {};

    const asignarCadena = (clave, valor) => {
      const resultado = limpiarCadena(valor);
      if (resultado !== undefined) datosActualizados[clave] = resultado;
    };

    const asignarEntero = (clave, valor) => {
      const resultado = limpiarEntero(valor);
      if (resultado !== undefined) datosActualizados[clave] = resultado;
    };

    const asignarBooleano = (clave, valor, actual = false) => {
      if (valor === undefined) return;
      datosActualizados[clave] = parseBooleanFlag(valor, actual);
    };

    asignarCadena("marca", marca);
    asignarCadena("modelo", modelo);
    asignarCadena("numeroSerie", numeroSerie);
    asignarCadena("usuario", usuario);
    asignarCadena("procesador", procesador);
    asignarCadena("velocidadProcesador", velocidadProcesador);
    asignarCadena("tipoAlmacenamiento", tipoAlmacenamiento);
    asignarCadena("sistemaOperativo", sistemaOperativo);
    asignarCadena("ofimatica", ofimatica);
    asignarCadena("antivirus", antivirus);
    asignarEntero("ram", ram);
    asignarEntero("cantidadAlmacenamiento", cantidadAlmacenamiento);
    asignarBooleano("esArriendo", esArriendo, Boolean(equipo.esArriendo));

    if (departamentoId !== undefined || departamentoTexto !== undefined) {
      let departamentoNombre;

      if (
        departamentoId !== undefined &&
        departamentoId !== null &&
        `${departamentoId}`.trim() !== ""
      ) {
        const parsedDepartamentoId = Number.parseInt(
          `${departamentoId}`.trim(),
          10
        );
        if (Number.isNaN(parsedDepartamentoId)) {
          return res
            .status(400)
            .json({ resp: "Identificador de departamento invalido." });
        }
        const registroDepartamento = await DepartamentoEquipoModel.findByPk(
          parsedDepartamentoId
        );
        if (!registroDepartamento) {
          return res
            .status(400)
            .json({ resp: "El departamento seleccionado no existe." });
        }
        departamentoNombre = registroDepartamento.name;
      } else if (departamentoTexto !== undefined) {
        const normalizado = normalizarTexto(departamentoTexto);
        if (!normalizado) {
          return res
            .status(400)
            .json({ resp: "El departamento no puede quedar vacio." });
        }
        departamentoNombre = normalizado;
      }

      if (departamentoNombre !== undefined) {
        datosActualizados.departamento = departamentoNombre;
      }
    }

    if (req.uploadedFile) {
      datosActualizados.imagen = req.uploadedFile;
    }

    if (Object.keys(datosActualizados).length === 0) {
      return res.json({ resp: "No se recibieron cambios para actualizar." });
    }

    await equipo.update(datosActualizados);

    await registrarLog(
      req.usuario?.id,
      "MODIFICAR_EQUIPO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { equipoId: equipo.id }
    );

    return res.json({ resp: "Equipo modificado correctamente." });
  } catch (error) {
    console.error("Error al modificar el equipo:", error);
    return res
      .status(500)
      .json({ resp: "Hubo un error al modificar el equipo." });
  }
};

/**
 * Elimina un equipo.
 * POST /eliminar-equipo/:id o DELETE /equipos/:id
 */
export const deleteEquiptment = async (req, res) => {
  const { id } = req.params;
  const usuario = req.usuario;
  if (usuario && usuario.tipoCuentaId === 4) {
    return res
      .status(403)
      .json({
        success: false,
        message: "No tiene permisos para eliminar equipos.",
      });
  }

  if (!id) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Error: No se proporcionó un ID de equipo válido",
      });
  }

  try {
    const equipo = await EquipoModel.findByPk(id);
    if (!equipo) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Equipo no encontrado, intente nuevamente",
        });
    }

    const observaciones = await ObservacionModel.findAll({
      where: { equipoId: id },
    });
    const t = await db.transaction();

    try {
      if (observaciones.length > 0) {
        await ObservacionModel.destroy({
          where: { equipoId: id },
          transaction: t,
        });
      }
      await equipo.destroy({ transaction: t });
      await t.commit();

      await registrarLog(
        req.usuario?.id,
        "ELIMINAR_EQUIPO",
        req.method,
        req.path,
        req.ip || req.connection.remoteAddress,
        { equipoId: id }
      );

      return res.json({
        success: true,
        message: "Equipo eliminado correctamente",
      });
    } catch (error) {
      await t.rollback();
      console.error("Error al eliminar el equipo:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Error al eliminar el equipo",
          error: error.message,
        });
    }
  } catch (error) {
    console.error("Error al buscar el equipo:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Error interno del servidor",
        error: error.message,
      });
  }
};

/**
 * Obtiene equipos por casa matriz.
 * GET /cliente/:id/equipos
 */
export const getEquipmentsByCasaMatriz = async (req, res) => {
  const { id } = req.params;
  const usuario = req.usuario;
  if (usuario && usuario.tipoCuentaId === 4) {
    const autorizados =
      req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
    req.autorizados = autorizados;
    if (!autorizados.includes(id)) {
      return res
        .status(403)
        .json({
          error: "No tiene permisos para ver los equipos de este cliente.",
        });
    }
  }

  try {
    const equipos = await EquipoModel.findAll({
      where: {
        [Op.or]: [{ casaMatrizId: id }, { "$sucursal.casaMatrizId$": id }],
      },
      include: [
        {
          model: CasaMatrizModel,
          as: "casaMatriz",
          attributes: ["id", "razonSocial"],
        },
        {
          model: SucursalModel,
          as: "sucursal",
          attributes: ["id", "sucursal", "estado", "casaMatrizId"],
          required: false,
          where: { casaMatrizId: id },
        },
        {
          model: TipoEquipoModel,
          as: "tipoEquipo",
          attributes: ["id", "name"],
        },
      ],
      order: [["numeroSecuencial", "ASC"]],
    });

    return res.json(equipos);
  } catch (error) {
    console.error("Error al obtener equipos de la casa matriz:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los equipos del cliente." });
  }
};

/**
 * Obtiene un equipo por ID.
 * GET /equipo/:id
 */
export const getEquipmentById = async (req, res) => {
  const { id } = req.params;
  const equipo = await EquipoModel.findByPk(id, {
    include: [
      { model: TipoEquipoModel, as: "tipoEquipo" },
      { model: CasaMatrizModel, as: "casaMatriz" },
      { model: SucursalModel, as: "sucursal" },
    ],
  });

  if (!equipo) {
    return res.status(404).json({ error: "Equipo no encontrado." });
  }

  const usuario = req.usuario;
  if (usuario && usuario.tipoCuentaId === 4) {
    const autorizados =
      req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
    req.autorizados = autorizados;
    const casaMatrizId =
      equipo.casaMatrizId ||
      (equipo.casaMatriz ? equipo.casaMatriz.id : undefined) ||
      (equipo.sucursal ? equipo.sucursal.casaMatrizId : undefined);

    if (!casaMatrizId || !autorizados.includes(casaMatrizId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para ver este equipo." });
    }
  }
  res.json(equipo);
};

/**
 * Obtiene tipos de equipos.
 * GET /tipos-equipos
 */
export const getTypeEquipments = async (req, res) => {
  const tipos = await TipoEquipoModel.findAll({ order: [["name", "ASC"]] });
  res.json(tipos);
};

/**
 * Obtiene formulario de un tipo de equipo.
 * GET /obtener-formulario/:id
 */
export const getEquipmentForm = async (req, res) => {
  const { id } = req.params;

  try {
    let campos = await TipoEquipoCampoModel.findAll({
      where: { tipoEquipoId: id },
      include: [{ model: CampoModel, as: "campo" }],
      order: [[{ model: CampoModel, as: "campo" }, "name", "ASC"]],
    });

    if (!campos.length) {
      const camposFallback = await CampoModel.findAll({
        where: {
          name: {
            [Op.in]: ["marca", "modelo", "numeroSerie", "usuario", "imagen"],
          },
        },
      });
      camposFallback.sort((a, b) => {
        const orden = ["marca", "modelo", "numeroSerie", "usuario", "imagen"];
        return orden.indexOf(a.name) - orden.indexOf(b.name);
      });
      if (camposFallback.length) {
        campos = camposFallback.map((campo) => ({ campo }));
      }
    }

    const camposTransformados = campos.map(({ campo }) => ({
      id: campo.id,
      name: campo.name,
      label: campo.label,
      type: campo.type,
      placeholder: campo.placeholder,
      required: campo.required,
      presetOptions: Array.isArray(campo.presetOptions)
        ? campo.presetOptions
        : [],
      standards: Array.isArray(campo.standards) ? campo.standards : [],
    }));

    res.json(camposTransformados);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener los campos" });
  }
};

/**
 * Obtiene estados de equipo.
 * GET /estados-equipos
 */
export const getEstadosEquipo = async (req, res) => {
  try {
    const estados = await EstadoEquipoModel.findAll();
    res.json(estados);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "Hubo un error al obtener los estados de equipos" });
  }
};

/**
 * Actualiza el estado de un equipo (PATCH).
 * PATCH /estados-equipos/:id
 */
export const actualizarEstadoEquipo = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    const equipo = await EquipoModel.findByPk(id);
    if (!equipo) {
      return res.status(404).json({ msg: "Equipo no encontrado" });
    }

    const estadoExiste = await EstadoEquipoModel.findByPk(estado);
    if (!estadoExiste) {
      return res.status(400).json({ msg: "Estado de equipo no válido" });
    }

    equipo.estado = estado;
    await equipo.save();

    res.json({ msg: "Estado de equipo actualizado correctamente" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "Hubo un error al actualizar el estado del equipo" });
  }
};

/**
 * Actualiza solo el estado de un equipo (POST).
 * POST /actualizar-estado-equipo/:id
 */
export const actualizarSoloEstadoEquipo = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    const equipo = await EquipoModel.findByPk(id);
    if (!equipo) {
      return res.status(404).json({ msg: "Equipo no encontrado" });
    }

    const estadoExiste = await EstadoEquipoModel.findByPk(estado);
    if (!estadoExiste) {
      return res.status(400).json({ msg: "Estado de equipo no válido" });
    }

    await EquipoModel.update({ estado: estado }, { where: { id: id } });

    res.json({ msg: "Estado de equipo actualizado correctamente" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "Hubo un error al actualizar el estado del equipo" });
  }
};

// =====================================================
// Tipos de Equipos
// =====================================================

/**
 * Crea un tipo de equipo.
 * POST /tipos-equipos
 */
export const crearTipoEquipo = async (req, res) => {
  const nombre = normalizarTexto(req.body?.name);
  const dict = normalizarCodigo(req.body?.dict);
  const campoIds = obtenerCampoIdsNormalizados(req.body?.campoIds);

  if (!nombre) {
    return res
      .status(400)
      .json({ error: "Debe indicar un nombre para el tipo de equipo." });
  }
  if (!dict) {
    return res
      .status(400)
      .json({ error: "Debe indicar un prefijo/código (dict) para el tipo." });
  }

  try {
    const conflicto = await TipoEquipoModel.findOne({
      where: { [Op.or]: [{ name: nombre }, { dict }] },
    });

    if (conflicto) {
      return res
        .status(409)
        .json({
          error: "Ya existe un tipo de equipo con el mismo nombre o código.",
        });
    }

    const t = await db.transaction();

    try {
      const nuevoTipo = await TipoEquipoModel.create(
        { name: nombre, dict },
        { transaction: t }
      );

      if (campoIds.length) {
        const campos = await CampoModel.findAll({
          where: { id: campoIds },
          transaction: t,
        });
        if (campos.length !== campoIds.length) {
          throw new Error("Uno o más campos seleccionados no existen.");
        }
        const relaciones = campoIds.map((campoId) => ({
          tipoEquipoId: nuevoTipo.id,
          campoId,
        }));
        await TipoEquipoCampoModel.bulkCreate(relaciones, {
          transaction: t,
          ignoreDuplicates: true,
        });
      }

      await t.commit();

      await registrarLog(
        req.usuario?.id,
        "CREAR_TIPO_EQUIPO",
        req.method,
        req.path,
        req.ip || req.connection.remoteAddress,
        { tipoEquipoId: nuevoTipo.id, name: nuevoTipo.name }
      );

      return res.status(201).json(nuevoTipo);
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      console.error("Error al crear tipo de equipo:", error);
      return res
        .status(500)
        .json({ error: "Hubo un error al crear el tipo de equipo." });
    }
  } catch (error) {
    console.error("Error al validar tipo de equipo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al validar el tipo de equipo." });
  }
};

/**
 * Actualiza un tipo de equipo.
 * PUT /tipos-equipos/:id
 */
export const actualizarTipoEquipo = async (req, res) => {
  const { id } = req.params;
  const tipo = await obtenerTipoEquipoPorId(id);

  if (!tipo) {
    return res.status(404).json({ error: "Tipo de equipo no encontrado." });
  }

  const nombre = normalizarTexto(req.body?.name);
  const dict = normalizarCodigo(req.body?.dict);
  const campoIds = obtenerCampoIdsNormalizados(req.body?.campoIds);

  if (!nombre && !dict && !campoIds.length) {
    return res
      .status(400)
      .json({ error: "Debe indicar al menos un campo a modificar." });
  }

  try {
    const updates = {};

    if (nombre) {
      const conflictoNombre = await TipoEquipoModel.findOne({
        where: { name: nombre, id: { [Op.ne]: tipo.id } },
      });
      if (conflictoNombre) {
        return res
          .status(409)
          .json({ error: "Ya existe otro tipo con ese nombre." });
      }
      updates.name = nombre;
    }

    if (dict) {
      const conflictoDict = await TipoEquipoModel.findOne({
        where: { dict, id: { [Op.ne]: tipo.id } },
      });
      if (conflictoDict) {
        return res
          .status(409)
          .json({ error: "Ya existe otro tipo con ese código." });
      }
      updates.dict = dict;
    }

    const t = await db.transaction();

    try {
      if (Object.keys(updates).length) {
        await tipo.update(updates, { transaction: t });
      }

      if (Array.isArray(req.body?.campoIds)) {
        const campos = await CampoModel.findAll({
          where: { id: campoIds },
          transaction: t,
        });
        if (campos.length !== campoIds.length) {
          throw new Error("Uno o más campos seleccionados no existen.");
        }
        await TipoEquipoCampoModel.destroy({
          where: { tipoEquipoId: tipo.id },
          transaction: t,
        });
        if (campoIds.length) {
          const relaciones = campoIds.map((campoId) => ({
            tipoEquipoId: tipo.id,
            campoId,
          }));
          await TipoEquipoCampoModel.bulkCreate(relaciones, { transaction: t });
        }
      }

      await t.commit();

      await registrarLog(
        req.usuario?.id,
        "MODIFICAR_TIPO_EQUIPO",
        req.method,
        req.path,
        req.ip || req.connection.remoteAddress,
        { tipoEquipoId: tipo.id }
      );

      return res.json(await TipoEquipoModel.findByPk(tipo.id));
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      console.error("Error al actualizar tipo de equipo:", error);
      return res
        .status(500)
        .json({ error: "Hubo un error al actualizar el tipo de equipo." });
    }
  } catch (error) {
    console.error("Error al modificar tipo de equipo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al modificar el tipo de equipo." });
  }
};

/**
 * Elimina un tipo de equipo.
 * DELETE /tipos-equipos/:id
 */
export const eliminarTipoEquipo = async (req, res) => {
  const { id } = req.params;
  const tipo = await obtenerTipoEquipoPorId(id);

  if (!tipo) {
    return res.status(404).json({ error: "Tipo de equipo no encontrado." });
  }

  try {
    const equiposAsociados = await EquipoModel.count({
      where: { tipoEquipoId: tipo.id },
    });
    if (equiposAsociados > 0) {
      return res
        .status(400)
        .json({
          error:
            "No es posible eliminar el tipo de equipo porque existen equipos asociados.",
        });
    }

    const t = await db.transaction();

    try {
      await TipoEquipoCampoModel.destroy({
        where: { tipoEquipoId: tipo.id },
        transaction: t,
      });
      await tipo.destroy({ transaction: t });
      await t.commit();

      await registrarLog(
        req.usuario?.id,
        "ELIMINAR_TIPO_EQUIPO",
        req.method,
        req.path,
        req.ip || req.connection.remoteAddress,
        { tipoEquipoId: id }
      );

      return res.json({ mensaje: "Tipo de equipo eliminado correctamente." });
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      console.error("Error al eliminar tipo de equipo:", error);
      return res
        .status(500)
        .json({ error: "Hubo un error al eliminar el tipo de equipo." });
    }
  } catch (error) {
    console.error("Error al validar eliminación de tipo de equipo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al validar la eliminación." });
  }
};

/**
 * Obtiene campos de un tipo de equipo.
 * GET /tipos-equipos/:id/campos
 */
export const obtenerCamposTipoEquipo = async (req, res) => {
  const { id } = req.params;
  const tipo = await obtenerTipoEquipoPorId(id);

  if (!tipo) {
    return res.status(404).json({ error: "Tipo de equipo no encontrado." });
  }

  try {
    const campos = await TipoEquipoCampoModel.findAll({
      where: { tipoEquipoId: tipo.id },
      include: [{ model: CampoModel, as: "campo" }],
      order: [[{ model: CampoModel, as: "campo" }, "name", "ASC"]],
    });

    const resultado = campos.map(({ campo }) => ({
      id: campo.id,
      name: campo.name,
      label: campo.label,
      type: campo.type,
      placeholder: campo.placeholder,
      required: campo.required,
      presetOptions: Array.isArray(campo.presetOptions)
        ? campo.presetOptions
        : [],
      standards: Array.isArray(campo.standards) ? campo.standards : [],
    }));

    return res.json(resultado);
  } catch (error) {
    console.error("Error al obtener los campos del tipo de equipo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los campos del tipo." });
  }
};

/**
 * Sincroniza campos de un tipo de equipo.
 * PUT /tipos-equipos/:id/campos
 */
export const sincronizarCamposTipoEquipo = async (req, res) => {
  const { id } = req.params;
  const tipo = await obtenerTipoEquipoPorId(id);

  if (!tipo) {
    return res.status(404).json({ error: "Tipo de equipo no encontrado." });
  }

  const campoIds = obtenerCampoIdsNormalizados(req.body?.campoIds);

  try {
    const campos = await CampoModel.findAll({ where: { id: campoIds } });
    if (campos.length !== campoIds.length) {
      return res
        .status(400)
        .json({ error: "Uno o más campos seleccionados no existen." });
    }

    const t = await db.transaction();

    try {
      await TipoEquipoCampoModel.destroy({
        where: { tipoEquipoId: tipo.id },
        transaction: t,
      });

      if (campoIds.length) {
        const relaciones = campoIds.map((campoId) => ({
          tipoEquipoId: tipo.id,
          campoId,
        }));
        await TipoEquipoCampoModel.bulkCreate(relaciones, { transaction: t });
      }

      await t.commit();

      const camposActualizados = await TipoEquipoCampoModel.findAll({
        where: { tipoEquipoId: tipo.id },
        include: [{ model: CampoModel, as: "campo" }],
        order: [[{ model: CampoModel, as: "campo" }, "name", "ASC"]],
      });

      const respuesta = camposActualizados.map(({ campo }) => ({
        id: campo.id,
        name: campo.name,
        label: campo.label,
        type: campo.type,
        placeholder: campo.placeholder,
        required: campo.required,
        presetOptions: Array.isArray(campo.presetOptions)
          ? campo.presetOptions
          : [],
        standards: Array.isArray(campo.standards) ? campo.standards : [],
      }));

      return res.json(respuesta);
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      console.error("Error al sincronizar campos del tipo:", error);
      return res
        .status(500)
        .json({ error: "Hubo un error al sincronizar los campos del tipo." });
    }
  } catch (error) {
    console.error("Error al validar campos del tipo de equipo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al validar los campos seleccionados." });
  }
};

// =====================================================
// Campos
// =====================================================

export const obtenerCampos = async (_req, res) => {
  try {
    const campos = await CampoModel.findAll({ order: [["name", "ASC"]] });
    return res.json(campos);
  } catch (error) {
    console.error("Error al obtener los campos:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener la lista de campos." });
  }
};

export const crearCampo = async (req, res) => {
  const nombreNormalizado = formatearNombreCampo(req.body?.name);
  const label = normalizarTexto(req.body?.label);
  const type = normalizarTexto(req.body?.type);
  const placeholder = normalizarTexto(req.body?.placeholder);
  const required = parseBooleanFlag(req.body?.required, false);
  const presetOptions = parsePresetOptions(req.body?.presetOptions);
  const standards = parseStandards(req.body?.standards);

  if (!nombreNormalizado) {
    return res
      .status(400)
      .json({ error: "Debe indicar un nombre válido para el campo." });
  }
  if (!label) {
    return res
      .status(400)
      .json({ error: "Debe indicar una etiqueta para el campo." });
  }
  if (!type) {
    return res
      .status(400)
      .json({ error: "Debe indicar un tipo de dato para el campo." });
  }

  try {
    const conflicto = await CampoModel.findOne({
      where: { [Op.or]: [{ name: nombreNormalizado }, { label }] },
    });
    if (conflicto) {
      return res
        .status(409)
        .json({ error: "Ya existe un campo con el mismo nombre o etiqueta." });
    }

    const campo = await CampoModel.create({
      name: nombreNormalizado,
      label,
      type,
      placeholder: placeholder || null,
      required,
      presetOptions,
      standards,
    });

    await registrarLog(
      req.usuario?.id,
      "CREAR_CAMPO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { campoId: campo.id, name: campo.name }
    );

    return res.status(201).json(campo);
  } catch (error) {
    console.error("Error al crear el campo:", error);
    return res.status(500).json({ error: "Hubo un error al crear el campo." });
  }
};

export const actualizarCampo = async (req, res) => {
  const { id } = req.params;
  const campo = await CampoModel.findByPk(id);

  if (!campo) {
    return res.status(404).json({ error: "Campo no encontrado." });
  }

  const nombre = req.body?.name
    ? formatearNombreCampo(req.body.name)
    : undefined;
  const label = req.body?.label ? normalizarTexto(req.body.label) : undefined;
  const type = req.body?.type ? normalizarTexto(req.body.type) : undefined;
  const placeholder =
    req.body?.placeholder !== undefined
      ? normalizarTexto(req.body.placeholder)
      : undefined;
  const required =
    req.body?.required !== undefined
      ? parseBooleanFlag(req.body.required, campo.required)
      : undefined;
  const presetOptions =
    req.body?.presetOptions !== undefined
      ? parsePresetOptions(req.body.presetOptions)
      : undefined;
  const standards =
    req.body?.standards !== undefined
      ? parseStandards(req.body.standards)
      : undefined;

  if (
    nombre === undefined &&
    label === undefined &&
    type === undefined &&
    placeholder === undefined &&
    required === undefined &&
    presetOptions === undefined &&
    standards === undefined
  ) {
    return res
      .status(400)
      .json({ error: "Debe indicar al menos un atributo para actualizar." });
  }

  try {
    if (nombre) {
      const conflictoNombre = await CampoModel.findOne({
        where: { name: nombre, id: { [Op.ne]: campo.id } },
      });
      if (conflictoNombre) {
        return res
          .status(409)
          .json({ error: "Ya existe otro campo con ese nombre." });
      }
    }

    if (label) {
      const conflictoLabel = await CampoModel.findOne({
        where: { label, id: { [Op.ne]: campo.id } },
      });
      if (conflictoLabel) {
        return res
          .status(409)
          .json({ error: "Ya existe otro campo con esa etiqueta." });
      }
    }

    const cambios = {};
    if (nombre) cambios.name = nombre;
    if (label) cambios.label = label;
    if (type) cambios.type = type;
    if (placeholder !== undefined) cambios.placeholder = placeholder || null;
    if (required !== undefined) cambios.required = required;
    if (presetOptions !== undefined) cambios.presetOptions = presetOptions;
    if (standards !== undefined) cambios.standards = standards;

    await campo.update(cambios);

    await registrarLog(
      req.usuario?.id,
      "MODIFICAR_CAMPO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { campoId: campo.id }
    );

    return res.json(campo);
  } catch (error) {
    console.error("Error al actualizar el campo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el campo." });
  }
};

export const eliminarCampo = async (req, res) => {
  const { id } = req.params;
  const campo = await CampoModel.findByPk(id);

  if (!campo) {
    return res.status(404).json({ error: "Campo no encontrado." });
  }

  try {
    const relaciones = await TipoEquipoCampoModel.count({
      where: { campoId: campo.id },
    });
    if (relaciones > 0) {
      return res
        .status(400)
        .json({
          error:
            "No es posible eliminar el campo porque está asignado a uno o más tipos de equipo.",
        });
    }

    await campo.destroy();
    return res.json({ mensaje: "Campo eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar el campo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el campo." });
  }
};

// =====================================================
// Departamentos
// =====================================================

export const obtenerDepartamentosEquipo = async (_req, res) => {
  try {
    const departamentos = await DepartamentoEquipoModel.findAll({
      order: [["name", "ASC"]],
    });
    return res.json(departamentos);
  } catch (error) {
    console.error("Error al obtener los departamentos de equipo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los departamentos de equipo." });
  }
};

export const crearDepartamentoEquipo = async (req, res) => {
  const nombre = normalizarTexto(req.body?.name);

  if (!nombre) {
    return res
      .status(400)
      .json({ error: "Debe indicar un nombre para el departamento." });
  }
  if (nombre.length < 2) {
    return res
      .status(400)
      .json({
        error: "El nombre del departamento debe tener al menos 2 caracteres.",
      });
  }

  try {
    const existente = await DepartamentoEquipoModel.findOne({
      where: sqlWhere(fn("LOWER", col("name")), nombre.toLowerCase()),
    });

    if (existente) {
      return res
        .status(409)
        .json({ error: "Ya existe un departamento con el mismo nombre." });
    }

    const departamento = await DepartamentoEquipoModel.create({ name: nombre });
    return res.status(201).json(departamento);
  } catch (error) {
    console.error("Error al crear el departamento de equipo:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ error: "Ya existe un departamento con el mismo nombre." });
    }
    return res
      .status(500)
      .json({ error: "Hubo un error al crear el departamento de equipo." });
  }
};

export const actualizarDepartamentoEquipo = async (req, res) => {
  const { id } = req.params;
  const departamento = await DepartamentoEquipoModel.findByPk(id);

  if (!departamento) {
    return res
      .status(404)
      .json({ error: "Departamento de equipo no encontrado." });
  }

  const nombre = normalizarTexto(req.body?.name);

  if (!nombre) {
    return res
      .status(400)
      .json({ error: "Debe indicar un nombre para el departamento." });
  }
  if (nombre.length < 2) {
    return res
      .status(400)
      .json({
        error: "El nombre del departamento debe tener al menos 2 caracteres.",
      });
  }

  const t = await db.transaction();

  try {
    const duplicado = await DepartamentoEquipoModel.findOne({
      where: {
        [Op.and]: [
          sqlWhere(fn("LOWER", col("name")), nombre.toLowerCase()),
          { id: { [Op.ne]: departamento.id } },
        ],
      },
      transaction: t,
    });

    if (duplicado) {
      await t.rollback();
      return res
        .status(409)
        .json({ error: "Ya existe otro departamento con el mismo nombre." });
    }

    const nombreAnterior = departamento.name;
    await departamento.update({ name: nombre }, { transaction: t });

    if (nombreAnterior !== nombre) {
      await EquipoModel.update(
        { departamento: nombre },
        { where: { departamento: nombreAnterior }, transaction: t }
      );
    }

    await t.commit();
    return res.json(departamento);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Error al actualizar el departamento de equipo:", error);
    return res
      .status(500)
      .json({
        error: "Hubo un error al actualizar el departamento de equipo.",
      });
  }
};

export const eliminarDepartamentoEquipo = async (req, res) => {
  const { id } = req.params;
  const departamento = await DepartamentoEquipoModel.findByPk(id);

  if (!departamento) {
    return res
      .status(404)
      .json({ error: "Departamento de equipo no encontrado." });
  }

  try {
    const equiposAsociados = await EquipoModel.count({
      where: { departamento: departamento.name },
    });
    if (equiposAsociados > 0) {
      return res
        .status(400)
        .json({
          error:
            "No es posible eliminar el departamento porque existen equipos asignados a él.",
        });
    }

    await departamento.destroy();
    return res.json({
      mensaje: "Departamento de equipo eliminado correctamente.",
    });
  } catch (error) {
    console.error("Error al eliminar el departamento de equipo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el departamento de equipo." });
  }
};
