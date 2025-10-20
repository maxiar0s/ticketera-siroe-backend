import bcrypt from "bcrypt";
import { col, fn, Op } from "sequelize";
import db from "../config/db.js";
import bucket from "../config/gcs.js";

import {
  CampoModel,
  CasaMatrizModel,
  CuentaModel,
  CuentaCasaMatrizModel,
  EquipoModel,
  EstadoCuentaModel,
  ObservacionModel,
  SucursalModel,
  TipoCuentaModel,
  TipoEquipoCampoModel,
  TipoEquipoModel,
  BitacoraModel,

  //?estado de equipos
  EstadoEquipoModel,
  //?estado de sucursales
  EstadoSucursalModel,
  VisitaProgramadaModel
} from "../models/index.js";
import EstadoCuenta from "../models/EstadoCuenta.js";

const cuentaIncludes = [
  { model: TipoCuentaModel, as: "tipoCuenta" },
  { model: EstadoCuentaModel, as: "estadoCuenta" },
  {
    model: CasaMatrizModel,
    as: "clientesAutorizados",
    attributes: ["id", "razonSocial"],
    through: { attributes: [] },
  },
];

const parseClientesAutorizados = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => `${item}`.trim())
          .filter((item) => item && item !== "undefined")
      )
    );
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parseClientesAutorizados(parsed);
      }
    } catch (error) {
      // Not JSON, fall through
    }

    if (value.includes(",")) {
      return parseClientesAutorizados(value.split(","));
    }

    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
};

const getAuthorizedClientIds = async (cuentaId) => {
  const rows = await CuentaCasaMatrizModel.findAll({
    where: { cuentaId },
    attributes: ["casaMatrizId"],
    raw: true,
  });

  return rows.map((row) => row.casaMatrizId);
};

const parseStringArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => `${item}`.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parseStringArray(parsed);
      }
    } catch (_error) {
      // Continuar con manejo estandar
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
};

const parseNonNegativeInt = (value, defaultValue = 0) => {
  if (value === undefined || value === null || value === "") {
    return { parsed: defaultValue, valid: true };
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return { parsed: defaultValue, valid: false };
  }

  return { parsed, valid: true };
};

const obtenerFechasReferenciaVisitas = () => {
  const ahora = new Date();
  const year = ahora.getUTCFullYear();
  const month = ahora.getUTCMonth();

  const aISO = (fecha) => fecha.toISOString().slice(0, 10);

  const inicioMes = new Date(Date.UTC(year, month, 1));
  const inicioMesSiguiente = new Date(Date.UTC(year, month + 1, 1));
  const inicioAnio = new Date(Date.UTC(year, 0, 1));
  const inicioAnioSiguiente = new Date(Date.UTC(year + 1, 0, 1));

  return {
    inicioMes: aISO(inicioMes),
    inicioMesSiguiente: aISO(inicioMesSiguiente),
    inicioAnio: aISO(inicioAnio),
    inicioAnioSiguiente: aISO(inicioAnioSiguiente),
  };
};

const obtenerConteoVisitasPorCliente = async (clienteIds = []) => {
  if (!clienteIds.length) {
    return {
      mensuales: {},
      emergencias: {},
    };
  }

  const {
    inicioMes,
    inicioMesSiguiente,
    inicioAnio,
    inicioAnioSiguiente,
  } = obtenerFechasReferenciaVisitas();

  const [visitasMensuales, visitasEmergencia] = await Promise.all([
    BitacoraModel.findAll({
      attributes: [
        "casaMatrizId",
        [fn("COUNT", col("id")), "total"],
      ],
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
      attributes: [
        "casaMatrizId",
        [fn("COUNT", col("id")), "total"],
      ],
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

const parseBooleanFlag = (value, defaultValue = false) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true" || lowered === "1") {
      return true;
    }
    if (lowered === "false" || lowered === "0") {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return defaultValue;
};

const isValidDateValue = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const bitacoraIncludes = [
  {
    model: CasaMatrizModel,
    as: "casaMatriz",
    attributes: ["id", "razonSocial", "rut"],
  },
  {
    model: SucursalModel,
    as: "sucursal",
    attributes: ["id", "sucursal"],
  },
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

const generateSignedUrl = async (fileName) => {
  try {
    const file = bucket.file(fileName);
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
    });
    return url;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const postCuenta = async (req, res) => {
  const {
    id,
    name,
    telefono,
    email,
    password,
    tipoCuentaId,
    estadoCuentaId,
    clientesAutorizados,
    esTecnico,
  } = req.body;

  const tipoCuentaNumero =
    tipoCuentaId !== undefined && tipoCuentaId !== null
      ? Number(tipoCuentaId)
      : undefined;
  const estadoCuentaNumero =
    estadoCuentaId !== undefined && estadoCuentaId !== null
      ? Number(estadoCuentaId)
      : undefined;
  const clienteIds = parseClientesAutorizados(clientesAutorizados);

  try {
    if (id) {
      const cuenta = await CuentaModel.findByPk(id);

      if (!cuenta) {
        return res.status(404).json({ error: "Cuenta no encontrada." });
      }

      const tipoCuentaFinal = !Number.isNaN(tipoCuentaNumero)
        ? tipoCuentaNumero
        : cuenta.tipoCuentaId;

      const updates = {
        name,
        telefono,
        tipoCuentaId: tipoCuentaFinal,
      };

      if (!Number.isNaN(estadoCuentaNumero)) {
        updates.estadoCuentaId = estadoCuentaNumero;
      }

      if (tipoCuentaFinal === 1) {
        updates.esTecnico = parseBooleanFlag(esTecnico, cuenta.esTecnico);
      } else {
        updates.esTecnico = false;
      }

      if (password && password.trim() !== "") {
        updates.password = await bcrypt.hash(password, 10);
      }

      cuenta.set(updates);
      await cuenta.save();

      if (tipoCuentaFinal === 4) {
        await cuenta.setClientesAutorizados(clienteIds);
      } else {
        await CuentaCasaMatrizModel.destroy({
          where: { cuentaId: cuenta.id },
        });
      }

      const cuentaActualizada = await CuentaModel.scope(
        "eliminarCampos"
      ).findByPk(id, {
        include: cuentaIncludes,
      });

      return res.json(cuentaActualizada);
    }

    const correoExistente = await CuentaModel.findOne({
      where: { email },
    });

    if (correoExistente) {
      return res.json({ error: "Correo electrÃ³nico ya registrado." });
    }

    if (!password || password.trim() === "") {
      return res
        .status(400)
        .json({ error: "La contraseÃ±a es obligatoria." });
    }

    if (
      tipoCuentaNumero === undefined ||
      Number.isNaN(tipoCuentaNumero)
    ) {
      return res
        .status(400)
        .json({ error: "Tipo de cuenta invÃ¡lido." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevaCuenta = await CuentaModel.create({
      name,
      telefono,
      email,
      tipoCuentaId: tipoCuentaNumero,
      password: hashedPassword,
      estadoCuentaId: 1,
      esTecnico:
        tipoCuentaNumero === 1
          ? parseBooleanFlag(esTecnico, false)
          : false,
    });

    if (tipoCuentaNumero === 4) {
      await nuevaCuenta.setClientesAutorizados(clienteIds);
    }

    const cuentaConAsociaciones = await CuentaModel.scope(
      "eliminarCampos"
    ).findByPk(nuevaCuenta.id, {
      include: cuentaIncludes,
    });

    return res.json(cuentaConAsociaciones);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Error al procesar la cuenta." });
  }
};

const getTecnicosDisponibles = async (_req, res) => {
  try {
    const tecnicos = await CuentaModel.findAll({
      where: {
        estadoCuentaId: 1,
        [Op.or]: [
          { tipoCuentaId: 2 },
          {
            tipoCuentaId: 1,
            esTecnico: true,
          },
        ],
      },
      attributes: ["id", "name", "email", "tipoCuentaId", "esTecnico"],
      order: [["name", "ASC"]],
    });

    return res.json(tecnicos);
  } catch (error) {
    console.error("Error al obtener tÃ©cnicos disponibles:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener el listado de tÃ©cnicos." });
  }
};

const getVerificarCorreo = async (req, res) => {
  const { correo } = req.query;

  const usuarioExistente = await CuentaModel.findOne({
    where: {
      email: correo,
    },
  });

  if (usuarioExistente) {
    return res.json({ isTaken: true });
  } else {
    return res.json({ isTaken: false });
  }
};

const postModificarCuenta = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.json({ resp: "Error al intentar modificar cuenta" });
  }

  const cuenta = await CuentaModel.findByPk(id);

  if (!cuenta) {
    return res.json({ resp: "Cuenta no encontrado, intente nuevamente" });
  }

  const { name, telefono, email, password } = req.body;

  const hashed_password = await bcrypt.hash(password, 10);

  cuenta.set({
    name,
    telefono,
    email,
    password: hashed_password,
  });
  cuenta.save();

  return res.json({ resp: "Cuenta modificado correctamente" });
};

const getEliminarCuenta = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.json({ resp: "No se ha encontrado un identificador unico" });
  }

  const cuenta = await CuentaModel.findByPk(id);

  if (!cuenta) {
    return res.json({ resp: "Cliente no encontrado, intente nuevamente" });
  }

  await cuenta.destroy();

  return res.json({ resp: "Cliente eliminado correctamente" });
};

const getUsuarios = async (req, res) => {
  let paginaActual = parseInt(req.query.pagina);
  const expresion = /^[1-999]$/;

  if (!expresion.test(paginaActual)) {
    paginaActual = 1;
  }

  // Limites y Offset para el paginador
  const limit = 12;
  const offset = (paginaActual - 1) * limit;

  const { option } = req.query;
  let tipoCuentaFiltro = { [Op.in]: [1, 2, 3, 4] };
  if (option === "Mesa de ayuda") {
    tipoCuentaFiltro = 3;
  } else if (option === "TÃ©cnico de soporte") {
    tipoCuentaFiltro = 2;
  } else if (option === "Administrador") {
    tipoCuentaFiltro = 1;
  } else if (option === "Cliente") {
    tipoCuentaFiltro = 4;
  }

  const where = { tipoCuentaId: tipoCuentaFiltro };

  const [cuentas, total] = await Promise.all([
    CuentaModel.scope("eliminarCampos").findAll({
      limit,
      offset,
      where,
      include: cuentaIncludes,
      order: [["id", "ASC"]],
    }),
    CuentaModel.count({
      where,
    }),
  ]);

  let paginas = Math.ceil(total / limit);
  if (total == 0) {
    paginas = 1;
  }

  return res.json({ cuentas, paginas });
};

const getUsuario = async (req, res) => {
  const { id } = req.params;

  const usuario = await CuentaModel.scope("eliminarCampos").findByPk(id, {
    include: cuentaIncludes,
  });

  if (!usuario) {
    return res.status(404).json({ error: "Cuenta no encontrada." });
  }

  return res.json(usuario);
};

const getPerfil = async (req, res) => {
  try {
    const cuenta = req.usuario;
    if (!cuenta) {
      return res.status(401).json({ error: "Sesion no valida." });
    }

    const perfil = await CuentaModel.scope("eliminarCampos").findByPk(
      cuenta.id,
      {
        include: cuentaIncludes,
      }
    );

    if (!perfil) {
      return res.status(404).json({ error: "Cuenta no encontrada." });
    }

    return res.json(perfil);
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener el perfil del usuario." });
  }
};

const actualizarPerfil = async (req, res) => {
  try {
    const cuentaSesion = req.usuario;
    if (!cuentaSesion) {
      return res.status(401).json({ error: "Sesion no valida." });
    }

    const cuenta = await CuentaModel.findByPk(cuentaSesion.id);
    if (!cuenta) {
      return res.status(404).json({ error: "Cuenta no encontrada." });
    }

    const {
      name,
      telefono,
      email,
      passwordActual,
      nuevoPassword,
    } = req.body ?? {};

    if (email && email !== cuenta.email) {
      const duplicado = await CuentaModel.findOne({
        where: { email },
      });
      if (duplicado) {
        return res
          .status(400)
          .json({ error: "El correo ya esta asociado a otra cuenta." });
      }
      cuenta.email = email.trim();
    }

    if (name) {
      cuenta.name = name.trim();
    }

    if (telefono !== undefined && telefono !== null && telefono !== "") {
      cuenta.telefono = telefono;
    }

    if (nuevoPassword) {
      if (!passwordActual) {
        return res.status(400).json({
          error: "Debes proporcionar la contrasena actual para realizar el cambio.",
        });
      }

      const coincide = await bcrypt.compare(passwordActual, cuenta.password);
      if (!coincide) {
        return res
          .status(400)
          .json({ error: "La contrasena actual no es valida." });
      }

      cuenta.password = await bcrypt.hash(nuevoPassword, 10);
    }

    await cuenta.save();

    const perfilActualizado = await CuentaModel.scope(
      "eliminarCampos"
    ).findByPk(cuenta.id, { include: cuentaIncludes });

    return res.json({
      mensaje: "Perfil actualizado correctamente.",
      perfil: perfilActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el perfil del usuario." });
  }
};

const postCliente = async (req, res) => {
  try {
    const {
      rut,
      razonSocial,
      encargadoGeneral,
      correo,
      telefonoEncargado,
      visitasMensuales,
      visitasEmergenciaAnuales,
    } = req.body;
    const imagenName = req.uploadedFile;
    console.log('Valor de req.uploadedFile en postCliente:', imagenName);

    if (!rut || !razonSocial || !encargadoGeneral || !correo || telefonoEncargado === undefined) {
      return res.status(400).json({
        resp: "Error: Faltan campos requeridos",
        recibido: req.body
      });
    }

    const clienteExistente = await CasaMatrizModel.findOne({
      where: {
        rut,
      },
    });

    if (clienteExistente) {
      return res.status(400).json({ 
        resp: "Error: Ya existe un cliente con ese RUT" 
      });
    }

    // Procesar el nÃºmero de telÃ©fono
    let telefonoEncargadoNum = telefonoEncargado;
    if (typeof telefonoEncargado === 'string') {
      // Eliminar cualquier carÃ¡cter no numÃ©rico
      const phoneNumber = telefonoEncargado.replace(/\D/g, '');
      telefonoEncargadoNum = parseInt(phoneNumber, 10);
    }

    // Validar que el nÃºmero de telÃ©fono sea vÃ¡lido (no mÃ¡s de 9 dÃ­gitos para Chile)
    if (isNaN(telefonoEncargadoNum) || telefonoEncargadoNum.toString().length > 9) {
      return res.status(400).json({ 
        resp: "Error: El nÃºmero de telÃ©fono no es vÃ¡lido", 
        recibido: telefonoEncargado 
      });
    }

    const visitasMensualesParse = parseNonNegativeInt(visitasMensuales);
    if (!visitasMensualesParse.valid) {
      return res.status(400).json({
        resp: "Error: La cantidad de visitas mensuales debe ser un nÃºmero vÃ¡lido mayor o igual a 0",
        recibido: visitasMensuales,
      });
    }

    const visitasEmergenciaParse = parseNonNegativeInt(visitasEmergenciaAnuales);
    if (!visitasEmergenciaParse.valid) {
      return res.status(400).json({
        resp: "Error: La cantidad de visitas de emergencia anuales debe ser un nÃºmero vÃ¡lido mayor o igual a 0",
        recibido: visitasEmergenciaAnuales,
      });
    }

    // Formatear el RUT
    const rutCasaMatriz = rut.toString().slice(0, 10);

    console.log('Datos a crear:', {
      rut: rutCasaMatriz,
      razonSocial,
      imagen: imagenName,
      encargadoGeneral,
      correo,
      telefonoEncargado: telefonoEncargadoNum,
      visitasMensuales: visitasMensualesParse.parsed,
      visitasEmergenciaAnuales: visitasEmergenciaParse.parsed,
    });

    const nuevoCliente = await CasaMatrizModel.create({
      rut: rutCasaMatriz,
      razonSocial,
      imagen: imagenName,
      encargadoGeneral,
      correo,
      telefonoEncargado: telefonoEncargadoNum,
      visitasMensuales: visitasMensualesParse.parsed,
      visitasEmergenciaAnuales: visitasEmergenciaParse.parsed,
    });

    return res.json({ resp: "Cliente creado correctamente" });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    return res.status(500).json({ 
      resp: "Error al crear cliente", 
      error: error.message 
    });
  }
};

const postModificarCliente = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.json({ resp: "Error al intentar modificar cliente" });
    }

    const cliente = await CasaMatrizModel.findByPk(id);

    if (!cliente) {
      return res.json({ resp: "Cliente no encontrado, intente nuevamente" });
    }

    // Extraer los datos del cuerpo de la solicitud
    const {
      rut,
      razonSocial,
      encargadoGeneral,
      correo,
      telefonoEncargado,
      visitasMensuales,
      visitasEmergenciaAnuales,
    } = req.body;

    // Verificar que todos los campos requeridos estÃ©n presentes
    if (
      !rut ||
      !razonSocial ||
      !encargadoGeneral ||
      !correo ||
      telefonoEncargado === undefined ||
      visitasMensuales === undefined ||
      visitasEmergenciaAnuales === undefined
    ) {
      console.log('Datos recibidos:', req.body);
      return res.status(400).json({ 
        resp: "Error: Faltan campos requeridos", 
        recibido: req.body 
      });
    }

    // Asegurarse de que telefonoEncargado sea un nÃºmero
    let telefonoEncargadoNum = telefonoEncargado;
    if (typeof telefonoEncargado === 'string') {
      // Eliminar cualquier carÃ¡cter no numÃ©rico
      const phoneNumber = telefonoEncargado.replace(/\D/g, '');
      telefonoEncargadoNum = parseInt(phoneNumber, 10);
    }

    // Validar que el nÃºmero de telÃ©fono sea vÃ¡lido (no mÃ¡s de 9 dÃ­gitos para Chile)
    if (isNaN(telefonoEncargadoNum) || telefonoEncargadoNum.toString().length > 9) {
      return res.status(400).json({ 
        resp: "Error: El nÃºmero de telÃ©fono no es vÃ¡lido", 
        recibido: telefonoEncargado 
      });
    }

    const visitasMensualesParse = parseNonNegativeInt(visitasMensuales, cliente.visitasMensuales);
    if (!visitasMensualesParse.valid) {
      return res.status(400).json({
        resp: "Error: La cantidad de visitas mensuales debe ser un nÃºmero vÃ¡lido mayor o igual a 0",
        recibido: visitasMensuales,
      });
    }

    const visitasEmergenciaParse = parseNonNegativeInt(visitasEmergenciaAnuales, cliente.visitasEmergenciaAnuales);
    if (!visitasEmergenciaParse.valid) {
      return res.status(400).json({
        resp: "Error: La cantidad de visitas de emergencia anuales debe ser un nÃºmero vÃ¡lido mayor o igual a 0",
        recibido: visitasEmergenciaAnuales,
      });
    }

    // Actualizar solo los campos que estÃ¡n presentes
    const updateData = {};
    if (rut) updateData.rut = rut;
    if (razonSocial) updateData.razonSocial = razonSocial;
    if (encargadoGeneral) updateData.encargadoGeneral = encargadoGeneral;
    if (correo) updateData.correo = correo;
    if (telefonoEncargadoNum) updateData.telefonoEncargado = telefonoEncargadoNum;
    updateData.visitasMensuales = visitasMensualesParse.parsed;
    updateData.visitasEmergenciaAnuales = visitasEmergenciaParse.parsed;

    // Si se subiÃ³ una nueva imagen, actualizar el campo imagen
    if (req.uploadedFile) {
      updateData.imagen = req.uploadedFile;
      console.log('Nueva imagen subida en modificaciÃ³n:', req.uploadedFile);
    }

    console.log('Datos a actualizar:', updateData);

    // Actualizar el cliente
    await cliente.update(updateData);

    return res.json({ resp: "Cliente modificado correctamente" });
  } catch (error) {
    console.error('Error al modificar cliente:', error);
    return res.status(500).json({ 
      resp: "Error al modificar cliente", 
      error: error.message 
    });
  }
};

const postEliminarCliente = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.json({ resp: "Error al intentar eliminar cliente" });
  }

  try {
    // Buscar el cliente sin incluir asociaciones para evitar el error
    const cliente = await CasaMatrizModel.findByPk(id);

    if (!cliente) {
      return res.json({ resp: "Cliente no encontrado, intente nuevamente" });
    }

    // Buscar y eliminar equipos asociados al cliente
    const equiposAsociados = await EquipoModel.findAll({
      where: { casaMatrizId: id }
    });

    if (equiposAsociados && equiposAsociados.length > 0) {
      for (const equipo of equiposAsociados) {
        await equipo.destroy();
      }
    }

    // Eliminar el cliente
    await cliente.destroy();

    return res.json({ 
      resp: "Cliente eliminado correctamente",
      success: true,
      clienteId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    return res.status(500).json({ 
      resp: "Error al eliminar cliente", 
      error: error.message,
      success: false
    });
  }
};

const postSucursal = async (req, res) => {
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
    const sucursal = await SucursalModel.findByPk(sucursalId);

    sucursal.set({
      sucursal: sucursalNombre,
      encargadoSucursal,
      correoSucursal,
      telefonoSucursal: telefonoSucursalFormateado,
      direccion,
    });

    await sucursal.save();

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

const getEliminarSucursal = async (req, res) => {
  const { id } = req.params;

  if (!id) return;

  const sucursal = await SucursalModel.findByPk(id);

  if (!sucursal) return;

  await sucursal.destroy();

  return res.json({ resp: "Sucursal eliminada exitosamente." });
};

const postEquipo = async (req, res) => {
  const {
    clienteId = null,
    sucursalId = null,
    departamento,
    tipoEquipoId,
  } = req.body;

  if (!clienteId && !sucursalId) {
    return res
      .status(400)
      .json({ error: "Debe proporcionar un clienteId o sucursalId" });
  }

  // Validar que el campo imagen estÃ© presente si se subiÃ³ archivo
  let imagenName = null;
  if (req.uploadedFile) {
    imagenName = req.uploadedFile;
    if (!imagenName || typeof imagenName !== 'string' || imagenName.trim() === '') {
      return res.status(400).json({ error: "Error al subir la imagen. Nombre de archivo invÃ¡lido." });
    }
  }

  const t = await db.transaction();

  try {
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

    // Crear el cÃ³digo del equipo
    const deptCode = departamento.substring(0, 4).toUpperCase();
    const numeroPadded = nextNumero.toString().padStart(3, "0");
    const codigoId = `SI${deptCode}${tipoEquipo.dict}${numeroPadded}`;

    // Crear el nuevo equipo, agregando el campo imagen si existe
    const equipoData = {
      numeroSecuencial: nextNumero,
      casaMatrizId: null,
      clienteId,
      sucursalId,
      estado: 1,
      marca: req.body.marca || null,
      modelo: req.body.modelo || null,
      codigoId,
      departamento,
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
    };
    if (imagenName) {
      equipoData.imagen = imagenName;
    }

    const nuevoEquipo = await EquipoModel.create(equipoData, { transaction: t });

    await t.commit();
    return res.json({
      message: "Equipo creado satisfactoriamente",
      nuevoEquipo,
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error(error);
    return res
      .status(500)
      .json({ error: "Error al crear el equipo", details: error.message });
  }
};

const postObservacion = async (req, res) => {
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

const postModificarEquipo = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ resp: "Error al intentar modificar el equipo" });
  }

  try {
    const equipo = await EquipoModel.findByPk(id);

    if (!equipo) {
      return res.status(404).json({ resp: "Equipo no encontrado, intente nuevamente" });
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
    } = req.body;

    const limpiarCadena = (valor) => {
      if (valor === undefined) {
        return undefined;
      }
      if (valor === null) {
        return null;
      }
      if (typeof valor !== 'string') {
        return valor;
      }
      const trimmed = valor.trim();
      if (trimmed === '' || trimmed.toLowerCase() === 'null') {
        return null;
      }
      return trimmed;
    };

    const limpiarEntero = (valor) => {
      const limpio = limpiarCadena(valor);
      if (limpio === undefined || limpio === null) {
        return limpio === undefined ? undefined : null;
      }
      const numero = parseInt(limpio, 10);
      return Number.isNaN(numero) ? null : numero;
    };

    const datosActualizados = {};

    const asignarCadena = (clave, valor) => {
      const resultado = limpiarCadena(valor);
      if (resultado !== undefined) {
        datosActualizados[clave] = resultado;
      }
    };

    const asignarEntero = (clave, valor) => {
      const resultado = limpiarEntero(valor);
      if (resultado !== undefined) {
        datosActualizados[clave] = resultado;
      }
    };

    asignarCadena('marca', marca);
    asignarCadena('modelo', modelo);
    asignarCadena('numeroSerie', numeroSerie);
    asignarCadena('usuario', usuario);
    asignarCadena('procesador', procesador);
    asignarCadena('velocidadProcesador', velocidadProcesador);
    asignarCadena('tipoAlmacenamiento', tipoAlmacenamiento);
    asignarCadena('sistemaOperativo', sistemaOperativo);
    asignarCadena('ofimatica', ofimatica);
    asignarCadena('antivirus', antivirus);
    asignarEntero('ram', ram);
    asignarEntero('cantidadAlmacenamiento', cantidadAlmacenamiento);

    if (req.uploadedFile) {
      datosActualizados.imagen = req.uploadedFile;
    }

    if (Object.keys(datosActualizados).length === 0) {
      return res.json({ resp: "No se recibieron cambios para actualizar." });
    }

    await equipo.update(datosActualizados);

    return res.json({ resp: "Equipo modificado correctamente." });
  } catch (error) {
    console.error('Error al modificar el equipo:', error);
    return res.status(500).json({ resp: "Hubo un error al modificar el equipo." });
  }
};

const deleteEquiptment = async (req, res) => {
  const { id } = req.params;
  const usuario = req.usuario;
  if (usuario && usuario.tipoCuentaId === 4) {
    return res.status(403).json({
      success: false,
      message: "No tiene permisos para eliminar equipos.",
    });
  }

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Error: No se proporcionÃ³ un ID de equipo vÃ¡lido",
    });
  }

  try {
    // Find the equipment by ID
    const equipo = await EquipoModel.findByPk(id);

    if (!equipo) {
      return res.status(404).json({
        success: false,
        message: "Equipo no encontrado, intente nuevamente",
      });
    }

    // Check if there are any related observations
    const observaciones = await ObservacionModel.findAll({
      where: { equipoId: id },
    });

    // Start a transaction to ensure data integrity
    const t = await db.transaction();

    try {
      // Delete all related observations first
      if (observaciones.length > 0) {
        await ObservacionModel.destroy({
          where: { equipoId: id },
          transaction: t,
        });
      }

      // Delete the equipment
      await equipo.destroy({ transaction: t });

      // Commit the transaction
      await t.commit();

      return res.json({
        success: true,
        message: "Equipo eliminado correctamente",
      });
    } catch (error) {
      // Rollback in case of error
      await t.rollback();
      console.error("Error al eliminar el equipo:", error);

      return res.status(500).json({
        success: false,
        message: "Error al eliminar el equipo",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Error al buscar el equipo:", error);

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};

const getResults = async (req, res) => {
  let paginaActual = Number.parseInt(req.query.pagina, 10);
  if (!Number.isInteger(paginaActual) || paginaActual < 1) {
    paginaActual = 1;
  }

  const usuario = req.usuario;
  let where = {};

  if (usuario && usuario.tipoCuentaId === 4) {
    const autorizados =
      req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
    req.autorizados = autorizados;
    if (!autorizados.length) {
      return res.json({ clientes: [], paginas: 1 });
    }
    where = { id: { [Op.in]: autorizados } };
  }

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

  let paginas = Math.ceil(total / limit);
  if (total === 0) {
    paginas = 1;
  }

  let clientesRespuesta = [];
  if (clientes.length) {
    const ids = clientes.map((cliente) => cliente.id);
    const { mensuales, emergencias } = await obtenerConteoVisitasPorCliente(ids);

    clientesRespuesta = clientes.map((cliente) => {
      const data = cliente.toJSON();
      const clienteId = data.id ?? cliente.id;
      return {
        ...data,
        visitasMensualesRealizadas: mensuales[clienteId] ?? 0,
        visitasEmergenciaAnualesRealizadas: emergencias[clienteId] ?? 0,
      };
    });
  }

  res.json({ clientes: clientesRespuesta, paginas });
};

const getClientesResumen = async (req, res) => {
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
      attributes: ["id", "razonSocial"],
      order: [["razonSocial", "ASC"]],
    });

    return res.json(clientes);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Error al obtener la lista de clientes." });
  }
};

const getClientesBitacora = async (req, res) => {
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
      attributes: ["id", "razonSocial", "rut"],
      order: [["razonSocial", "ASC"]],
    });

    return res.json(clientes);
  } catch (error) {
    console.error("Error al obtener clientes para bitacora:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los clientes." });
  }
};

const getClientById = async (req, res) => {
  let paginaActual = parseInt(req.query.pagina);
  const expresion = /^[1-999]$/;

  if (!expresion.test(paginaActual)) {
    paginaActual = 1;
  }

  // Limites y Offset para el paginador
  const limit = 5;
  const offset = (paginaActual - 1) * limit;

  const { id } = req.params;
  const { option } = req.query;
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
    const { mensuales, emergencias } = await obtenerConteoVisitasPorCliente([cliente.id]);
    const data = cliente.toJSON();
    const clienteId = data.id ?? cliente.id;
    clienteRespuesta = {
      ...data,
      visitasMensualesRealizadas: mensuales[clienteId] ?? 0,
      visitasEmergenciaAnualesRealizadas: emergencias[clienteId] ?? 0,
    };
  }

  return res.json({ cliente: clienteRespuesta, paginas });
};

const getSucursalesPorCliente = async (req, res) => {
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
      attributes: ["id", "sucursal", "estado", "encargadoSucursal", "correoSucursal", "telefonoSucursal"],
      include: [
        { model: EstadoSucursalModel, as: "estadoSucursal", attributes: ["id", "name"] },
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

const getSucursalById = async (req, res) => {
  let paginaActual = Number.parseInt(req.query.pagina, 10);
  if (!Number.isInteger(paginaActual) || paginaActual < 1) {
    paginaActual = 1;
  }

  // Limites y Offset para el paginador
  const limit = 8;
  const offset = (paginaActual - 1) * limit;

  const { id } = req.params;
  const { option, sort } = req.query;
  const usuario = req.usuario;
  let estado = { [Op.in]: [1, 2, 3] };
  if (option === "Terminados") {
    estado = 3;
  } else if (option === "Pendientes") {
    estado = 2;
  }

  // Determine sort order based on query parameter
  const sortOrder = sort === "asc" ? "ASC" : "DESC";

  const [sucursal, total] = await Promise.all([
    SucursalModel.findByPk(id, {
      include: [
        { model: CasaMatrizModel, as: "casaMatriz" },
        {
          model: EquipoModel,
          as: "equipos",
          limit,
          offset,
          include: [
            { model: TipoEquipoModel, as: "tipoEquipo" },
            { model: ObservacionModel, as: "observaciones" },
          ],
          where: { estado },
          order: [["numeroSecuencial", sortOrder]],
        },
      ],
    }),
    SucursalModel.count({
      where: { id },
      include: [{ model: EquipoModel, as: "equipos", where: { estado } }],
    }),
  ]);

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

  let paginas = Math.ceil(total / limit);
  if (total === 0) {
    paginas = 1;
  }

  return res.json({ sucursal, paginas });
};

const getEquipmentsByCasaMatriz = async (req, res) => {
  const { id } = req.params;
  const usuario = req.usuario;
  if (usuario && usuario.tipoCuentaId === 4) {
    const autorizados =
      req.autorizados ?? (await getAuthorizedClientIds(usuario.id));
    req.autorizados = autorizados;
    if (!autorizados.includes(id)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para ver los equipos de este cliente." });
    }
  }

  try {
    const equipos = await EquipoModel.findAll({
      where: {
        [Op.or]: [
          { casaMatrizId: id },
          { '$sucursal.casaMatrizId$': id },
        ],
      },
      include: [
        { model: CasaMatrizModel, as: "casaMatriz", attributes: ["id", "razonSocial"] },
        {
          model: SucursalModel,
          as: "sucursal",
          attributes: ["id", "sucursal", "estado", "casaMatrizId"],
          required: false,
          where: { casaMatrizId: id },
        },
        { model: TipoEquipoModel, as: "tipoEquipo", attributes: ["id", "name"] },
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

const getTypeEquipments = async (req, res) => {
  const tipos = await TipoEquipoModel.findAll();

  res.json(tipos);
};

const getEquipmentForm = async (req, res) => {
  const { id } = req.params;

  try {
    let campos = await TipoEquipoCampoModel.findAll({
      where: {
        tipoEquipoId: id,
      },
      include: [{ model: CampoModel, as: "campo" }],
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
        campos = camposFallback.map((campo) => ({
          campo,
        }));
      }
    }

    const camposTransformados = campos.map(({ campo }) => ({
      id: campo.id,
      name: campo.name,
      label: campo.label,
      type: campo.type,
      placeholder: campo.placeholder,
      required: campo.required,
    }));

    res.json(camposTransformados);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener los campos" });
  }
};

const getEquipmentById = async (req, res) => {
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

//?get estado de equipos
const getEstadosEquipo = async (req, res) => {
  try {
      const estados = await EstadoEquipoModel.findAll();
      res.json(estados);
  } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'Hubo un error al obtener los estados de equipos' });
  }
};

//? Actualizar el estado de un equipo
const actualizarEstadoEquipo = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
      const equipo = await EquipoModel.findByPk(id);
      
      if (!equipo) {
          return res.status(404).json({ msg: 'Equipo no encontrado' });
      }

      // Verificar que el estado exista
      const estadoExiste = await EstadoEquipoModel.findByPk(estado);
      if (!estadoExiste) {
          return res.status(400).json({ msg: 'Estado de equipo no vÃ¡lido' });
      }

      // Actualizar el estado
      equipo.estado = estado;
      await equipo.save();

      res.json({ msg: 'Estado de equipo actualizado correctamente' });
  } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'Hubo un error al actualizar el estado del equipo' });
  }
};

//? Actualizar solo el estado de un equipo (POST)
const actualizarSoloEstadoEquipo = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
      const equipo = await EquipoModel.findByPk(id);
      
      if (!equipo) {
          return res.status(404).json({ msg: 'Equipo no encontrado' });
      }

      // Verificar que el estado exista
      const estadoExiste = await EstadoEquipoModel.findByPk(estado);
      if (!estadoExiste) {
          return res.status(400).json({ msg: 'Estado de equipo no vÃ¡lido' });
      }

      // Actualizar SOLO el estado usando update en lugar de save
      await EquipoModel.update(
          { estado: estado },
          { where: { id: id } }
      );

      res.json({ msg: 'Estado de equipo actualizado correctamente' });
  } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'Hubo un error al actualizar el estado del equipo' });
  }
};

const generarUrl = async (req, res) => {
  const { fileName } = req.params;
  try {
    const signedUrl = await generateSignedUrl(fileName);
    res.json({ signedUrl });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Error al generar la URL firmada' });
  }
};

const getBitacoras = async (req, res) => {
  try {
    const usuario = req.usuario;
    const {
      pagina = 1,
      limite = 10,
      clienteId,
      sucursalId,
      buscar,
    } = req.query;

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limite, 10) || 10, 1);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};

    if (clienteId) {
      where.casaMatrizId = clienteId;
    }

    if (sucursalId) {
      where.sucursalId = sucursalId;
    }

    const terminoBusqueda = buscar ? `${buscar}`.trim() : "";
    if (terminoBusqueda) {
      where[Op.or] = [
        { titulo: { [Op.like]: `%${terminoBusqueda}%` } },
        { descripcion: { [Op.like]: `%${terminoBusqueda}%` } },
      ];
    }

    if (usuario.tipoCuentaId === 4) {
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
        return res.status(403).json({
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
      // Log para verificar adjuntos
      if (data.length > 0) {
        console.log('Bitacoras listado, ejemplo adjuntos:', data[0].adjuntos);
      } else {
        console.log('Bitacoras listado vacÃ­o');
      }
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

const getBitacoraById = async (req, res) => {
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
        return res.status(403).json({
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

const getVisitasProgramadas = async (req, res) => {
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

const crearBitacora = async (req, res) => {
  try {
    const usuario = req.usuario;

    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para crear bitacoras." });
    }

    // Support parsing when payload is sent as formData.payload (frontend sends payload + files)
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

    if (!casaMatrizId || !fechaVisita || !horaLlegada || !horaSalida) {
      return res.status(400).json({
        error:
          "Los campos casaMatrizId, fechaVisita, horaLlegada y horaSalida son obligatorios.",
      });
    }

    const descripcionLimpia = descripcion ? `${descripcion}`.trim() : "";
    if (!descripcionLimpia) {
      return res
        .status(400)
        .json({ error: "La nota de la bitacora no puede estar vacia." });
    }

    if (!isValidDateValue(fechaVisita)) {
      return res
        .status(400)
        .json({ error: "La fecha de la visita no es valida." });
    }

    if (!isValidDateValue(horaLlegada) || !isValidDateValue(horaSalida)) {
      return res.status(400).json({
        error: "Las horas de llegada y salida deben tener un formato valido.",
      });
    }

    const llegadaDate = new Date(horaLlegada);
    const salidaDate = new Date(horaSalida);
    if (salidaDate <= llegadaDate) {
      return res.status(400).json({
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
        return res.status(400).json({
          error: "La sucursal seleccionada no pertenece al cliente indicado.",
        });
      }
    }

    const tecnicosArray = parseStringArray(tecnicos);
    if (tecnicosArray.length === 0) {
      return res.status(400).json({
        error: "Debe indicar al menos un tecnico responsable de la visita.",
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
      isEmergencia: parseBooleanFlag(isEmergencia, false),
    });

    // Si hay archivos subidos por multipart/form-data, guardarlos en adjuntos
    if (req.uploadedFiles && Array.isArray(req.uploadedFiles) && req.uploadedFiles.length > 0) {
      try {
        nuevaBitacora.adjuntos = req.uploadedFiles;
        await nuevaBitacora.save();
      } catch (err) {
        console.error('Error guardando adjuntos en bitacora:', err);
      }
    }

    const bitacoraCreada = await BitacoraModel.findByPk(nuevaBitacora.id, {
      include: bitacoraIncludes,
    });

    return res.status(201).json(bitacoraCreada);
  } catch (error) {
    console.error("Error al crear bitacora:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al crear la bitacora." });
  }
};

const crearVisitaProgramada = async (req, res) => {
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
      return res.status(400).json({
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
      return res.status(400).json({
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
        return res.status(400).json({
          error: "La sucursal seleccionada no pertenece al cliente indicado.",
        });
      }
    }

    const tecnicosArray = parseStringArray(tecnicos);
    if (tecnicosArray.length === 0) {
      return res.status(400).json({
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

    const visitaCreada = await VisitaProgramadaModel.findByPk(
      nuevaVisita.id,
      {
        include: [
          { model: CasaMatrizModel, as: "casaMatriz" },
          { model: SucursalModel, as: "sucursal" },
        ],
      }
    );

    return res.status(201).json(visitaCreada);
  } catch (error) {
    console.error("Error al agendar visita:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al agendar la visita." });
  }
};

const actualizarBitacora = async (req, res) => {
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

    // Support parsing when payload is sent as formData.payload (frontend sends payload + files)
    let bodyData = req.body;
    if (req.body && req.body.payload) {
      try {
        bodyData = JSON.parse(req.body.payload);
      } catch (err) {
        // if payload not JSON, fallback to raw
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

    const cambios = {};

    if (usuario.tipoCuentaId === 2) {
      if (typeof descripcion === "undefined") {
        return res.status(400).json({
          error: "El tecnico solo puede modificar la nota de la bitacora.",
        });
      }

      const descripcionLimpia = `${descripcion ?? ""}`.trim();
      if (!descripcionLimpia) {
        return res
          .status(400)
          .json({ error: "La nota de la bitacora no puede estar vacia." });
      }

      cambios.descripcion = descripcionLimpia;
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
            .json({ error: "El cliente de la bitacora no puede quedar vacio." });
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
        if (!isValidDateValue(horaLlegada)) {
          return res.status(400).json({
            error: "La hora de llegada debe tener un formato valido.",
          });
        }
        cambios.horaLlegada = new Date(horaLlegada);
      }

      if (typeof horaSalida !== "undefined") {
        if (!isValidDateValue(horaSalida)) {
          return res.status(400).json({
            error: "La hora de salida debe tener un formato valido.",
          });
        }
        cambios.horaSalida = new Date(horaSalida);
      }

      if (typeof tecnicos !== "undefined") {
        const tecnicosArray = parseStringArray(tecnicos);
        if (tecnicosArray.length === 0) {
          return res.status(400).json({
            error: "Debe indicar al menos un tecnico responsable de la visita.",
          });
        }
        cambios.tecnicos = tecnicosArray;
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
            return res
              .status(404)
              .json({ error: "Sucursal no encontrada." });
          }

          const clienteDestino =
            cambios.casaMatrizId ?? bitacora.casaMatrizId;
          if (sucursal.casaMatrizId !== clienteDestino) {
            return res.status(400).json({
              error: "La sucursal seleccionada no pertenece al cliente indicado.",
            });
          }

          cambios.sucursalId = sucursalId;
        }
      }
    }

    if (cambios.horaLlegada || cambios.horaSalida) {
      const llegada = cambios.horaLlegada
        ? new Date(cambios.horaLlegada)
        : new Date(bitacora.horaLlegada);
      const salida = cambios.horaSalida
        ? new Date(cambios.horaSalida)
        : new Date(bitacora.horaSalida);

      if (salida <= llegada) {
        return res.status(400).json({
          error: "La hora de salida debe ser posterior a la hora de llegada.",
        });
      }
    }

    if (Object.keys(cambios).length === 0) {
      const current = await BitacoraModel.findByPk(id, { include: bitacoraIncludes });
      return res.json(current);
    }

    cambios.actualizadoPorId = usuario.id;

    await bitacora.update(cambios);
    // Si llegaron archivos subidos, anexarlos a adjuntos existentes
    if (req.uploadedFiles && Array.isArray(req.uploadedFiles) && req.uploadedFiles.length > 0) {
      try {
        const actuales = bitacora.adjuntos || [];
        const nuevos = Array.isArray(actuales) ? actuales.concat(req.uploadedFiles) : req.uploadedFiles;
        bitacora.adjuntos = nuevos;
        await bitacora.save();
      } catch (err) {
        console.error('Error al anexar adjuntos a bitacora:', err);
      }
    }
    await bitacora.reload({ include: bitacoraIncludes });

    return res.json(bitacora);
  } catch (error) {
    console.error("Error al actualizar bitacora:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar la bitacora." });
  }
};

const eliminarBitacora = async (req, res) => {
  try {
    const { id } = req.params;

    const bitacora = await BitacoraModel.findByPk(id);
    if (!bitacora) {
      return res.status(404).json({ error: "Bitacora no encontrada." });
    }

    await bitacora.destroy();
    return res.json({ mensaje: "Bitacora eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar bitacora:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar la bitacora." });
  }
};

const eliminarVisitaProgramada = async (req, res) => {
  try {
    const { id } = req.params;

    const visita = await VisitaProgramadaModel.findByPk(id);
    if (!visita) {
      return res.status(404).json({ error: "Visita programada no encontrada." });
    }

    await visita.destroy();
    return res.json({ mensaje: "Visita programada eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar visita programada:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar la visita programada." });
  }
};

//?get estado de sucursales
const getEstadosSucursal = async (req, res) => {
  try {
      const estados = await EstadoSucursalModel.findAll();
      res.json(estados);
  } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'Hubo un error al obtener los estados de sucursales' });
  }
};

//? Actualizar el estado de una sucursal
const actualizarEstadoSucursal = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
      const sucursal = await SucursalModel.findByPk(id);
      
      if (!sucursal) {
          return res.status(404).json({ msg: 'Sucursal no encontrada' });
      }

      // Verificar que el estado exista
      const estadoExiste = await EstadoSucursalModel.findByPk(estado);
      if (!estadoExiste) {
          return res.status(400).json({ msg: 'Estado de sucursal no vÃ¡lido' });
      }

      // Actualizar SOLO el estado usando update en lugar de save
      await SucursalModel.update(
          { estado: estado },
          { where: { id: id } }
      );

      res.json({ msg: 'Estado de sucursal actualizado correctamente' });
  } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'Hubo un error al actualizar el estado de la sucursal' });
  }
};

export {
  postCuenta,
  getVerificarCorreo,
  getTecnicosDisponibles,
  postModificarCuenta,
  getEliminarCuenta,
  getUsuarios,
  getPerfil,
  actualizarPerfil,
  getUsuario,
  postCliente,
  postModificarCliente,
  postEliminarCliente,
  postSucursal,
  getEliminarSucursal,
  postEquipo,
  postObservacion,
  postModificarEquipo,
  deleteEquiptment,
  getResults,
  getClientesResumen,
  getClientesBitacora,
  getClientById,
  getSucursalesPorCliente,
  getTypeEquipments,
  getEquipmentForm,
  getSucursalById,
  getEquipmentsByCasaMatriz,
  getEquipmentById,
  generarUrl,
  getBitacoras,
  getBitacoraById,
  crearBitacora,
  actualizarBitacora,
  eliminarBitacora,
  getVisitasProgramadas,
  crearVisitaProgramada,
  eliminarVisitaProgramada,
  //? Estados de equipos
  getEstadosEquipo,
  actualizarEstadoEquipo,
  actualizarSoloEstadoEquipo,
  //? Estados de sucursales
  getEstadosSucursal,
  actualizarEstadoSucursal
};




