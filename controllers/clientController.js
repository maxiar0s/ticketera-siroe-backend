/**
 * @fileoverview Controlador de clientes y sucursales.
 * Maneja CRUD de casas matriz, sucursales y datos bancarios.
 */

import { col, fn, Op } from "sequelize";
import {
  CasaMatrizModel,
  CuentaCasaMatrizModel,
  EquipoModel,
  EstadoSucursalModel,
  ObservacionModel,
  SucursalModel,
  TipoEquipoModel,
} from "../models/index.js";
import registrarLog from "../utils/logger.js";
import {
  parseBooleanFlag,
  parseBooleanQueryParam,
  parseNonNegativeInt,
  parseNumericQueryParam,
  parseStringArray,
} from "../utils/parsers.js";
import {
  normalizarTexto,
  obtenerFechasReferenciaVisitas,
} from "../utils/validators.js";
import {
  mapearDatosBancariosADB,
  obtenerDatosBancariosDesdeBody,
  transformarClienteRespuesta,
  DATOS_BANCARIOS_COLUMNAS_DB,
} from "../utils/builders.js";
import { BitacoraModel } from "../models/index.js";

/**
 * Obtiene IDs de clientes autorizados para una cuenta.
 * @param {number} cuentaId - ID de la cuenta
 * @returns {Promise<number[]>} Array de IDs de casas matriz
 */
export const getAuthorizedClientIds = async (cuentaId) => {
  const rows = await CuentaCasaMatrizModel.findAll({
    where: { cuentaId },
    attributes: ["casaMatrizId"],
    raw: true,
  });

  return rows.map((row) => row.casaMatrizId);
};

/**
 * Obtiene conteo de visitas por cliente (mensuales y emergencias).
 * @param {number[]} clienteIds - Array de IDs de clientes
 * @returns {Promise<{mensuales: object, emergencias: object}>}
 */
export const obtenerConteoVisitasPorCliente = async (clienteIds = []) => {
  if (!clienteIds.length) {
    return {
      mensuales: {},
      emergencias: {},
    };
  }

  const { inicioMes, inicioMesSiguiente, inicioAnio, inicioAnioSiguiente } =
    obtenerFechasReferenciaVisitas();

  const [visitasMensuales, visitasEmergencia] = await Promise.all([
    BitacoraModel.findAll({
      attributes: ["casaMatrizId", [fn("COUNT", col("id")), "total"]],
      where: {
        casaMatrizId: { [Op.in]: clienteIds },
        isEmergencia: false,
        fechaVisita: {
          [Op.gte]: inicioMes,
          [Op.lt]: inicioMesSiguiente,
        },
      },
      group: ["casaMatrizId"],
    }),
    BitacoraModel.findAll({
      attributes: ["casaMatrizId", [fn("COUNT", col("id")), "total"]],
      where: {
        casaMatrizId: { [Op.in]: clienteIds },
        isEmergencia: true,
        fechaVisita: {
          [Op.gte]: inicioAnio,
          [Op.lt]: inicioAnioSiguiente,
        },
      },
      group: ["casaMatrizId"],
    }),
  ]);

  const mensuales = {};
  visitasMensuales.forEach((row) => {
    const id = row.get("casaMatrizId");
    mensuales[id] = Number(row.get("total")) || 0;
  });

  const emergencias = {};
  visitasEmergencia.forEach((row) => {
    const id = row.get("casaMatrizId");
    emergencias[id] = Number(row.get("total")) || 0;
  });

  return { mensuales, emergencias };
};

/**
 * Crea un nuevo cliente (casa matriz).
 * POST /ingresar-cliente
 */
export const postCliente = async (req, res) => {
  try {
    const {
      rut,
      razonSocial,
      encargadoGeneral,
      correo,
      telefonoEncargado,
      visitasMensuales,
      visitasEmergenciaAnuales,
      servicios,
      esLead: esLeadEntrada,
    } = req.body ?? {};
    const { presente: datosBancariosPresentes, datos: datosBancarios } =
      obtenerDatosBancariosDesdeBody(req.body);
    const imagenName = req.uploadedFile;
    const esLead = parseBooleanFlag(esLeadEntrada, false);
    console.log("Valor de req.uploadedFile en postCliente:", imagenName);

    const camposRequeridos =
      !esLead &&
      (!rut ||
        !razonSocial ||
        !encargadoGeneral ||
        !correo ||
        telefonoEncargado === undefined);

    if (camposRequeridos) {
      return res.status(400).json({
        resp: "Error: Faltan campos requeridos",
        recibido: req.body,
      });
    }

    const rutNormalizado =
      typeof rut === "string"
        ? rut.trim().slice(0, 10)
        : rut !== undefined && rut !== null
        ? `${rut}`.slice(0, 10)
        : null;

    if (rutNormalizado && rutNormalizado.length) {
      const clienteExistente = await CasaMatrizModel.findOne({
        where: {
          rut: rutNormalizado,
        },
      });

      if (clienteExistente) {
        return res
          .status(400)
          .json({ resp: "Error: Ya existe un cliente con ese RUT" });
      }
    }

    let telefonoEncargadoNum = null;
    if (telefonoEncargado !== undefined && telefonoEncargado !== null) {
      const telefonoLimpio = `${telefonoEncargado}`.replace(/\D/g, "");
      telefonoEncargadoNum = telefonoLimpio.length
        ? Number.parseInt(telefonoLimpio, 10)
        : null;
    }

    if (!esLead) {
      if (
        telefonoEncargadoNum === null ||
        Number.isNaN(telefonoEncargadoNum) ||
        telefonoEncargadoNum.toString().length > 9
      ) {
        return res.status(400).json({
          resp: "Error: El número de teléfono no es válido",
          recibido: telefonoEncargado,
        });
      }
    } else if (
      telefonoEncargadoNum !== null &&
      telefonoEncargadoNum.toString().length > 9
    ) {
      return res.status(400).json({
        resp: "Error: El número de teléfono no es válido",
        recibido: telefonoEncargado,
      });
    }

    const visitasMensualesParse = parseNonNegativeInt(visitasMensuales);
    if (!visitasMensualesParse.valid) {
      return res.status(400).json({
        resp: "Error: La cantidad de visitas mensuales debe ser un número válido mayor o igual a 0",
        recibido: visitasMensuales,
      });
    }

    const visitasEmergenciaParse = parseNonNegativeInt(
      visitasEmergenciaAnuales
    );
    if (!visitasEmergenciaParse.valid) {
      return res.status(400).json({
        resp: "Error: La cantidad de visitas de emergencia anuales debe ser un número válido mayor o igual a 0",
        recibido: visitasEmergenciaAnuales,
      });
    }

    const serviciosSanitizados = parseStringArray(servicios);

    console.log("Datos a crear:", {
      rut: rutNormalizado,
      razonSocial,
      imagen: imagenName,
      encargadoGeneral,
      correo,
      telefonoEncargado: telefonoEncargadoNum,
      visitasMensuales: visitasMensualesParse.parsed,
      visitasEmergenciaAnuales: visitasEmergenciaParse.parsed,
      servicios: serviciosSanitizados,
      datosBancarios,
      esLead,
    });

    const nuevaCasaMatriz = await CasaMatrizModel.create({
      rut: rutNormalizado ?? null,
      razonSocial: razonSocial ?? null,
      imagen: imagenName,
      encargadoGeneral: encargadoGeneral ?? null,
      correo: correo ?? null,
      telefonoEncargado: telefonoEncargadoNum,
      visitasMensuales: visitasMensualesParse.parsed,
      visitasEmergenciaAnuales: visitasEmergenciaParse.parsed,
      servicios: serviciosSanitizados,
      esLead,
      ...mapearDatosBancariosADB(
        datosBancariosPresentes ? datosBancarios : null
      ),
    });

    // LOG
    await registrarLog(
      req.usuario?.id,
      "CREAR_CLIENTE",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      {
        clienteId: nuevaCasaMatriz.id,
        razonSocial: nuevaCasaMatriz.razonSocial,
      }
    );

    return res.json({ resp: "Cliente creado correctamente" });
  } catch (error) {
    console.error("Error al crear cliente:", error);
    return res.status(500).json({
      resp: "Error al crear cliente",
      error: error.message,
    });
  }
};

/**
 * Elimina un cliente y sus equipos asociados.
 * POST /eliminar-cliente/:id o DELETE /clientes/:id
 */
export const postEliminarCliente = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.json({ resp: "Error al intentar eliminar cliente" });
  }

  try {
    const cliente = await CasaMatrizModel.findByPk(id);

    if (!cliente) {
      return res.json({ resp: "Cliente no encontrado, intente nuevamente" });
    }

    // Buscar y eliminar equipos asociados al cliente
    const equiposAsociados = await EquipoModel.findAll({
      where: { casaMatrizId: id },
    });

    if (equiposAsociados && equiposAsociados.length > 0) {
      for (const equipo of equiposAsociados) {
        await equipo.destroy();
      }
    }

    await cliente.destroy();

    // LOG
    await registrarLog(
      req.usuario?.id,
      "ELIMINAR_CLIENTE",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { clienteId: id }
    );

    return res.json({
      resp: "Cliente eliminado correctamente",
      success: true,
      clienteId: id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    return res.status(500).json({
      resp: "Error al eliminar cliente",
      error: error.message,
      success: false,
    });
  }
};

/**
 * Modifica un cliente existente.
 * POST /modificar-cliente/:id
 */
export const postModificarCliente = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.json({ resp: "Error al intentar modificar cliente" });
    }

    const cliente = await CasaMatrizModel.findByPk(id);
    if (!cliente) {
      return res.json({ resp: "Cliente no encontrado, intente nuevamente" });
    }

    const body = req.body ?? {};
    const {
      rut,
      razonSocial,
      encargadoGeneral,
      correo,
      telefonoEncargado,
      visitasMensuales,
      visitasEmergenciaAnuales,
      servicios,
      esLead: esLeadEntrada,
    } = body;

    const { presente: datosBancariosPresentes, datos: datosBancarios } =
      obtenerDatosBancariosDesdeBody(body);

    const esLead = parseBooleanFlag(esLeadEntrada, cliente.esLead);
    const campoFueEnviado = (campo) =>
      Object.prototype.hasOwnProperty.call(body, campo);

    const normalizarCampoTexto = (valor) => {
      if (valor === undefined) {
        return undefined;
      }
      const texto = normalizarTexto(`${valor ?? ""}`);
      return texto && texto.length ? texto : null;
    };

    const normalizarRut = (valor) => {
      if (valor === undefined) {
        return undefined;
      }
      const texto = normalizarTexto(`${valor ?? ""}`);
      if (!texto || !texto.length) {
        return null;
      }
      return texto.slice(0, 10);
    };

    const rutNormalizado = normalizarRut(rut);
    if (rutNormalizado && rutNormalizado !== cliente.rut) {
      const clienteExistente = await CasaMatrizModel.findOne({
        where: { rut: rutNormalizado },
        attributes: ["id"],
      });
      if (clienteExistente && clienteExistente.id !== cliente.id) {
        return res
          .status(400)
          .json({ resp: "Error: Ya existe un cliente con ese RUT" });
      }
    }

    const razonSocialNormalizada = normalizarCampoTexto(razonSocial);
    const encargadoNormalizado = normalizarCampoTexto(encargadoGeneral);
    const correoNormalizado = normalizarCampoTexto(correo);

    const telefonoFueEnviado = campoFueEnviado("telefonoEncargado");
    let telefonoEncargadoNum = cliente.telefonoEncargado ?? null;
    if (telefonoFueEnviado) {
      const telefonoLimpio = `${telefonoEncargado ?? ""}`.replace(/\D/g, "");
      telefonoEncargadoNum = telefonoLimpio.length
        ? Number.parseInt(telefonoLimpio, 10)
        : null;
    }

    if (
      telefonoFueEnviado &&
      telefonoEncargadoNum !== null &&
      telefonoEncargadoNum.toString().length > 9
    ) {
      return res.status(400).json({
        resp: "Error: El número de teléfono no es válido",
        recibido: telefonoEncargado,
      });
    }

    const visitasMensualesParse = parseNonNegativeInt(
      visitasMensuales,
      cliente.visitasMensuales
    );
    if (!visitasMensualesParse.valid) {
      return res.status(400).json({
        resp: "Error: La cantidad de visitas mensuales debe ser un número válido mayor o igual a 0",
        recibido: visitasMensuales,
      });
    }

    const visitasEmergenciaParse = parseNonNegativeInt(
      visitasEmergenciaAnuales,
      cliente.visitasEmergenciaAnuales
    );
    if (!visitasEmergenciaParse.valid) {
      return res.status(400).json({
        resp: "Error: La cantidad de visitas de emergencia anuales debe ser un número válido mayor o igual a 0",
        recibido: visitasEmergenciaAnuales,
      });
    }

    const rutFinal =
      rutNormalizado !== undefined ? rutNormalizado : cliente.rut;
    const razonFinal =
      razonSocialNormalizada !== undefined
        ? razonSocialNormalizada
        : cliente.razonSocial;
    const encargadoFinal =
      encargadoNormalizado !== undefined
        ? encargadoNormalizado
        : cliente.encargadoGeneral;
    const correoFinal =
      correoNormalizado !== undefined ? correoNormalizado : cliente.correo;
    const telefonoFinal = telefonoEncargadoNum;

    if (
      !esLead &&
      (!rutFinal ||
        !razonFinal ||
        !encargadoFinal ||
        !correoFinal ||
        telefonoFinal === null)
    ) {
      return res.status(400).json({
        resp: "Error: Faltan campos requeridos",
        recibido: req.body,
      });
    }

    if (
      !esLead &&
      telefonoFinal !== null &&
      telefonoFinal.toString().length > 9
    ) {
      return res.status(400).json({
        resp: "Error: El número de teléfono no es válido",
        recibido: telefonoEncargado,
      });
    }

    const updateData = {};
    if (rutNormalizado !== undefined) {
      updateData.rut = rutNormalizado;
    }
    if (razonSocialNormalizada !== undefined) {
      updateData.razonSocial = razonSocialNormalizada;
    }
    if (encargadoNormalizado !== undefined) {
      updateData.encargadoGeneral = encargadoNormalizado;
    }
    if (correoNormalizado !== undefined) {
      updateData.correo = correoNormalizado;
    }
    if (telefonoFueEnviado) {
      updateData.telefonoEncargado = telefonoEncargadoNum;
    }

    updateData.visitasMensuales = visitasMensualesParse.parsed;
    updateData.visitasEmergenciaAnuales = visitasEmergenciaParse.parsed;

    if (Object.prototype.hasOwnProperty.call(body, "servicios")) {
      updateData.servicios = parseStringArray(servicios);
    }

    if (datosBancariosPresentes) {
      Object.assign(updateData, mapearDatosBancariosADB(datosBancarios));
    }

    if (req.uploadedFile) {
      updateData.imagen = req.uploadedFile;
      console.log("Nueva imagen subida en modificación:", req.uploadedFile);
    }

    updateData.esLead = esLead;

    console.log("Datos a actualizar:", updateData);
    await cliente.update(updateData);

    // LOG
    await registrarLog(
      req.usuario?.id,
      "MODIFICAR_CLIENTE",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { clienteId: cliente.id, razonSocial: cliente.razonSocial }
    );

    return res.json({ resp: "Cliente modificado correctamente" });
  } catch (error) {
    console.error("Error al modificar cliente:", error);
    return res.status(500).json({
      resp: "Error al modificar cliente",
      error: error.message,
    });
  }
};

/**
 * Crea o actualiza una sucursal.
 * POST /ingresar-sucursal
 */
export const postSucursal = async (req, res) => {
  const {
    encargadoSucursal,
    correoSucursal,
    telefonoSucursal,
    sucursal,
    direccion,
    sucursalId,
    casaMatrizId,
  } = req.body;

  const telefonoSinEspacios = telefonoSucursal.replace(/\s+/g, "");
  const telefonoSucursalFormateado = telefonoSinEspacios.toString().slice(0, 9);
  const sucursalNombre = sucursal;

  if (!casaMatrizId && !sucursalId) return;

  if (sucursalId) {
    const sucursalExistente = await SucursalModel.findByPk(sucursalId);

    sucursalExistente.set({
      sucursal: sucursalNombre,
      encargadoSucursal,
      correoSucursal,
      telefonoSucursal: telefonoSucursalFormateado,
      direccion,
    });

    await sucursalExistente.save();

    const sucursalModificada = await SucursalModel.findByPk(sucursalId, {
      include: [{ model: EquipoModel, as: "equipos", attributes: [] }],
      attributes: {
        include: [[fn("COUNT", col("equipos.id")), "equiposCount"]],
      },
      group: ["Sucursales.id"],
      subQuery: false,
    });

    return res.json({ resp: "mod", sucursal: sucursalModificada });
  } else {
    const nuevaSucursal = await SucursalModel.create({
      encargadoSucursal,
      correoSucursal,
      estado: 1,
      telefonoSucursal: telefonoSucursalFormateado,
      sucursal,
      direccion,
      casaMatrizId,
    });

    return res.json({ resp: "creada", sucursal: nuevaSucursal });
  }
};

/**
 * Elimina una sucursal.
 * GET /eliminar-sucursal/:id
 */
export const getEliminarSucursal = async (req, res) => {
  const { id } = req.params;

  if (!id) return;

  const sucursal = await SucursalModel.findByPk(id);

  if (!sucursal) return;

  await sucursal.destroy();

  return res.json({ resp: "Sucursal eliminada exitosamente." });
};

/**
 * Lista clientes paginados con filtros.
 * GET /clientes
 */
export const getResults = async (req, res) => {
  let paginaActual = Number.parseInt(req.query.pagina, 10);
  if (!Number.isInteger(paginaActual) || paginaActual < 1) {
    paginaActual = 1;
  }

  const usuario = req.usuario;
  const whereConditions = [];

  if (usuario && usuario.tipoCuentaId === 4) {
    const autorizados =
      req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
    req.autorizados = autorizados;
    if (!autorizados.length) {
      return res.json({ clientes: [], paginas: 1 });
    }
    whereConditions.push({ id: { [Op.in]: autorizados } });
  }

  const serviciosFiltro = parseStringArray(
    req.query.servicios ?? req.query.servicio ?? null
  );
  const visitasMensualesMin = parseNumericQueryParam(
    req.query.visitasMensualesMin
  );
  const visitasMensualesMax = parseNumericQueryParam(
    req.query.visitasMensualesMax
  );
  const visitasEmergenciaMin = parseNumericQueryParam(
    req.query.visitasEmergenciaMin
  );
  const visitasEmergenciaMax = parseNumericQueryParam(
    req.query.visitasEmergenciaMax
  );
  const esLeadFiltro = parseBooleanQueryParam(req.query.esLead);
  const datosBancariosFiltro = parseBooleanQueryParam(
    req.query.tieneDatosBancarios ?? req.query.datosBancarios
  );

  if (serviciosFiltro.length) {
    serviciosFiltro.forEach((servicio) => {
      const termino = servicio.replace(/"/g, '\\"');
      whereConditions.push({
        servicios: { [Op.like]: `%\"${termino}\"%` },
      });
    });
  }

  const visitasMensualesRango = {};
  if (visitasMensualesMin !== null) {
    visitasMensualesRango[Op.gte] = visitasMensualesMin;
  }
  if (visitasMensualesMax !== null) {
    visitasMensualesRango[Op.lte] = visitasMensualesMax;
  }
  if (Object.keys(visitasMensualesRango).length) {
    whereConditions.push({ visitasMensuales: visitasMensualesRango });
  }

  const visitasEmergenciaRango = {};
  if (visitasEmergenciaMin !== null) {
    visitasEmergenciaRango[Op.gte] = visitasEmergenciaMin;
  }
  if (visitasEmergenciaMax !== null) {
    visitasEmergenciaRango[Op.lte] = visitasEmergenciaMax;
  }
  if (Object.keys(visitasEmergenciaRango).length) {
    whereConditions.push({
      visitasEmergenciaAnuales: visitasEmergenciaRango,
    });
  }

  if (esLeadFiltro !== null) {
    whereConditions.push({ esLead: esLeadFiltro });
  }

  if (datosBancariosFiltro === true) {
    whereConditions.push({
      [Op.or]: DATOS_BANCARIOS_COLUMNAS_DB.map((columna) => ({
        [columna]: { [Op.ne]: null },
      })),
    });
  } else if (datosBancariosFiltro === false) {
    whereConditions.push({
      [Op.and]: DATOS_BANCARIOS_COLUMNAS_DB.map((columna) => ({
        [columna]: { [Op.is]: null },
      })),
    });
  }

  const where = whereConditions.length ? { [Op.and]: whereConditions } : {};

  // Limites y Offset para el paginador
  const limit = 8;
  const offset = (paginaActual - 1) * limit;

  const [clientes, total] = await Promise.all([
    CasaMatrizModel.findAll({
      where,
      limit,
      offset,
      order: [["razonSocial", "ASC"]],
    }),
    CasaMatrizModel.count({ where }),
  ]);

  const puedeVerDatosBancarios =
    usuario && [1, 5].includes(usuario.tipoCuentaId);

  let paginas = Math.ceil(total / limit);
  if (total === 0) {
    paginas = 1;
  }

  let clientesRespuesta = [];
  if (clientes.length) {
    const ids = clientes.map((cliente) => cliente.id);
    const { mensuales, emergencias } = await obtenerConteoVisitasPorCliente(
      ids
    );

    clientesRespuesta = clientes.map((cliente) => {
      const respuestaBase =
        transformarClienteRespuesta(cliente, {
          incluirDatosBancarios: puedeVerDatosBancarios,
        }) ?? cliente;
      const clienteId = respuestaBase.id ?? cliente.id;
      return {
        ...respuestaBase,
        visitasMensualesRealizadas: mensuales[clienteId] ?? 0,
        visitasEmergenciaAnualesRealizadas: emergencias[clienteId] ?? 0,
      };
    });
  }

  res.json({ clientes: clientesRespuesta, paginas });
};

/**
 * Lista resumida de clientes (id, razonSocial).
 * GET /clientes/listado
 */
export const getClientesResumen = async (req, res) => {
  try {
    const usuario = req.usuario;
    let where = {};

    if (usuario && usuario.tipoCuentaId === 4) {
      const autorizados =
        req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
      req.autorizados = autorizados;
      if (!autorizados.length) {
        return res.json([]);
      }
      where = { id: { [Op.in]: autorizados } };
    }

    const clientes = await CasaMatrizModel.findAll({
      where,
      attributes: ["id", "razonSocial", "servicios", "esLead", "rut"],
      order: [["razonSocial", "ASC"]],
    });

    const respuesta = clientes.map((cliente) => {
      const data = cliente?.toJSON ? cliente.toJSON() : cliente;
      return {
        ...data,
        servicios: parseStringArray(data?.servicios),
      };
    });

    return res.json(respuesta);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Error al obtener la lista de clientes." });
  }
};

/**
 * Lista clientes para bitácoras.
 * GET /bitacoras/clientes
 */
export const getClientesBitacora = async (req, res) => {
  try {
    const usuario = req.usuario;
    const where = {};

    if (usuario && usuario.tipoCuentaId === 4) {
      const autorizados =
        req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
      req.autorizados = autorizados;
      if (autorizados.length === 0) {
        return res.json([]);
      }
      where.id = { [Op.in]: autorizados };
    }

    const clientes = await CasaMatrizModel.findAll({
      where,
      attributes: ["id", "razonSocial", "rut", "servicios", "esLead"],
      order: [["razonSocial", "ASC"]],
    });

    const respuesta = clientes.map((cliente) => {
      const data = cliente?.toJSON ? cliente.toJSON() : cliente;
      return {
        ...data,
        servicios: parseStringArray(data?.servicios),
      };
    });

    return res.json(respuesta);
  } catch (error) {
    console.error("Error al obtener clientes para bitacora:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los clientes." });
  }
};

/**
 * Obtiene un cliente por ID con sus sucursales.
 * GET /cliente/:id
 */
export const getClientById = async (req, res) => {
  let paginaActual = parseInt(req.query.pagina);
  const expresion = /^[1-999]$/;

  if (!expresion.test(paginaActual)) {
    paginaActual = 1;
  }

  const limit = 5;
  const offset = (paginaActual - 1) * limit;

  const { id } = req.params;
  const { option } = req.query;
  const usuario = req.usuario;
  const puedeVerDatosBancarios =
    usuario && [1, 5].includes(usuario.tipoCuentaId);
  if (usuario && usuario.tipoCuentaId === 4) {
    const autorizados =
      req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
    req.autorizados = autorizados;
    if (!autorizados.includes(id)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para ver este cliente." });
    }
  }
  let estado = { [Op.in]: [1, 2, 3] };
  if (option === "Terminados") {
    estado = 3;
  } else if (option === "Pendientes") {
    estado = 2;
  }

  const [cliente, total] = await Promise.all([
    CasaMatrizModel.findByPk(id, {
      include: [
        {
          model: SucursalModel,
          as: "sucursales",
          limit,
          offset,
          where: { estado },
          include: [{ model: EquipoModel, as: "equipos", attributes: [] }],
          order: [["fechaIngreso", "DESC"]],
          attributes: {
            include: [[fn("COUNT", col("equipos.id")), "equiposCount"]],
          },
          group: ["Sucursales.id"],
          subQuery: false,
        },
      ],
    }),
    CasaMatrizModel.count({
      where: { id },
      include: [{ model: SucursalModel, as: "sucursales", where: { estado } }],
    }),
  ]);

  let paginas = Math.ceil(total / limit);
  if (total == 0) {
    paginas = 1;
  }

  let clienteRespuesta = null;
  if (cliente) {
    const { mensuales, emergencias } = await obtenerConteoVisitasPorCliente([
      cliente.id,
    ]);
    const data =
      transformarClienteRespuesta(cliente, {
        incluirDatosBancarios: puedeVerDatosBancarios,
      }) ?? cliente;
    const clienteId = data.id ?? cliente.id;
    clienteRespuesta = {
      ...data,
      visitasMensualesRealizadas: mensuales[clienteId] ?? 0,
      visitasEmergenciaAnualesRealizadas: emergencias[clienteId] ?? 0,
    };
  }

  return res.json({ cliente: clienteRespuesta, paginas });
};

/**
 * Lista sucursales de un cliente.
 * GET /cliente/:id/sucursales
 */
export const getSucursalesPorCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = req.usuario;

    if (usuario && usuario.tipoCuentaId === 4) {
      const autorizados =
        req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
      req.autorizados = autorizados;
      if (!autorizados.includes(id)) {
        return res
          .status(403)
          .json({ error: "No tiene permisos para ver este cliente." });
      }
    }

    const sucursales = await SucursalModel.findAll({
      where: { casaMatrizId: id },
      order: [["sucursal", "ASC"]],
      attributes: [
        "id",
        "sucursal",
        "estado",
        "encargadoSucursal",
        "correoSucursal",
        "telefonoSucursal",
      ],
      include: [
        {
          model: EstadoSucursalModel,
          as: "estadoSucursal",
          attributes: ["id", "name"],
        },
      ],
    });

    return res.json(sucursales);
  } catch (error) {
    console.error("Error al obtener sucursales del cliente:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener las sucursales del cliente." });
  }
};

/**
 * Obtiene una sucursal por ID con sus equipos.
 * GET /sucursal/:id
 */
export const getSucursalById = async (req, res) => {
  let paginaActual = Number.parseInt(req.query.pagina, 10);
  if (!Number.isInteger(paginaActual) || paginaActual < 1) {
    paginaActual = 1;
  }

  const limit = 8;
  const offset = (paginaActual - 1) * limit;

  const { id } = req.params;
  const {
    option,
    sort,
    fechaInicio,
    fechaFin,
    tipoEquipoIds,
    tipoEquipoId,
    departamentos,
    departamento,
    ramMin,
    ramMax,
    almacenamientoMin,
    almacenamientoMax,
    conRegistroFotografico,
  } = req.query;
  const usuario = req.usuario;

  let filtroEstado = { [Op.in]: [1, 2, 3] };
  if (option === "Terminados") {
    filtroEstado = 3;
  } else if (option === "Pendientes") {
    filtroEstado = 2;
  }

  const sortOrder = sort === "asc" ? "ASC" : "DESC";

  const sucursal = await SucursalModel.findByPk(id, {
    include: [{ model: CasaMatrizModel, as: "casaMatriz" }],
  });

  if (!sucursal) {
    return res.status(404).json({ error: "Sucursal no encontrada." });
  }

  if (usuario && usuario.tipoCuentaId === 4) {
    const autorizados =
      req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
    req.autorizados = autorizados;
    if (!autorizados.includes(sucursal.casaMatrizId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para ver esta sucursal." });
    }
  }

  const whereEquipos = { sucursalId: id };
  if (typeof filtroEstado === "number") {
    whereEquipos.estado = filtroEstado;
  } else if (filtroEstado) {
    whereEquipos.estado = filtroEstado;
  }

  const parseDateOnly = (value) => {
    if (!value || typeof value !== "string") {
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString().slice(0, 10);
  };

  const fechaInicioFiltro = parseDateOnly(fechaInicio);
  const fechaFinFiltro = parseDateOnly(fechaFin);
  if (fechaInicioFiltro && fechaFinFiltro) {
    whereEquipos.fechaIngreso = {
      [Op.between]: [fechaInicioFiltro, fechaFinFiltro],
    };
  } else if (fechaInicioFiltro) {
    whereEquipos.fechaIngreso = { [Op.gte]: fechaInicioFiltro };
  } else if (fechaFinFiltro) {
    whereEquipos.fechaIngreso = { [Op.lte]: fechaFinFiltro };
  }

  const tiposFiltro = parseStringArray(tipoEquipoIds ?? tipoEquipoId)
    .map((valor) => Number.parseInt(valor, 10))
    .filter((valor) => Number.isInteger(valor));
  if (tiposFiltro.length > 0) {
    whereEquipos.tipoEquipoId = { [Op.in]: tiposFiltro };
  }

  const departamentosFiltro = parseStringArray(departamentos ?? departamento);
  if (departamentosFiltro.length > 0) {
    whereEquipos.departamento = { [Op.in]: departamentosFiltro };
  }

  const parseOptionalInt = (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const ramMinValor = parseOptionalInt(ramMin);
  const ramMaxValor = parseOptionalInt(ramMax);
  if (ramMinValor !== null || ramMaxValor !== null) {
    const rangoRam = {};
    if (ramMinValor !== null) {
      rangoRam[Op.gte] = ramMinValor;
    }
    if (ramMaxValor !== null) {
      rangoRam[Op.lte] = ramMaxValor;
    }
    whereEquipos.ram = rangoRam;
  }

  const almacenamientoMinValor = parseOptionalInt(almacenamientoMin);
  const almacenamientoMaxValor = parseOptionalInt(almacenamientoMax);
  if (almacenamientoMinValor !== null || almacenamientoMaxValor !== null) {
    const rangoAlmacenamiento = {};
    if (almacenamientoMinValor !== null) {
      rangoAlmacenamiento[Op.gte] = almacenamientoMinValor;
    }
    if (almacenamientoMaxValor !== null) {
      rangoAlmacenamiento[Op.lte] = almacenamientoMaxValor;
    }
    whereEquipos.cantidadAlmacenamiento = rangoAlmacenamiento;
  }

  if (conRegistroFotografico === "true") {
    whereEquipos.imagen = { [Op.notIn]: [null, ""] };
  } else if (conRegistroFotografico === "false") {
    whereEquipos.imagen = { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: "" }] };
  }

  const { rows: equipos, count: totalEquipos } =
    await EquipoModel.findAndCountAll({
      where: whereEquipos,
      limit,
      offset,
      order: [["numeroSecuencial", sortOrder]],
      include: [
        { model: TipoEquipoModel, as: "tipoEquipo" },
        { model: ObservacionModel, as: "observaciones" },
      ],
      distinct: true,
    });

  let paginas = Math.ceil(totalEquipos / limit);
  if (totalEquipos === 0) {
    paginas = 1;
  }

  const sucursalJson = sucursal.toJSON();
  sucursalJson.equipos = equipos;

  return res.json({ sucursal: sucursalJson, paginas });
};

/**
 * Obtiene estados de sucursal disponibles.
 * GET /estados-sucursales
 */
export const getEstadosSucursal = async (req, res) => {
  try {
    const estadosSucursal = await EstadoSucursalModel.findAll();
    return res.json(estadosSucursal);
  } catch (error) {
    console.error("Error al obtener estados de sucursal:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los estados de sucursal." });
  }
};

/**
 * Actualiza el estado de una sucursal.
 * POST /actualizar-estado-sucursal/:id
 */
export const actualizarEstadoSucursal = async (req, res) => {
  const { id } = req.params;
  const { estadoId } = req.body;

  try {
    const sucursal = await SucursalModel.findByPk(id);
    if (!sucursal) {
      return res.status(404).json({ error: "Sucursal no encontrada." });
    }

    await sucursal.update({ estado: estadoId });

    const sucursalActualizada = await SucursalModel.findByPk(id, {
      include: [
        {
          model: EstadoSucursalModel,
          as: "estadoSucursal",
          attributes: ["id", "name"],
        },
      ],
    });

    return res.json(sucursalActualizada);
  } catch (error) {
    console.error("Error al actualizar estado de sucursal:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el estado de la sucursal." });
  }
};
