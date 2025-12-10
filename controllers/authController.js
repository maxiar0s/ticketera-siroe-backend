/**
 * @fileoverview Controlador de autenticación y gestión de usuarios.
 * Maneja creación, modificación, listado y eliminación de cuentas.
 */

import bcrypt from "bcrypt";
import { Op } from "sequelize";
import {
  CasaMatrizModel,
  CuentaModel,
  CuentaCasaMatrizModel,
  EstadoCuentaModel,
  TipoCuentaModel,
} from "../models/index.js";
import registrarLog from "../utils/logger.js";
import {
  parseBooleanFlag,
  parseClientesAutorizados,
} from "../utils/parsers.js";
import { transformarClienteRespuesta } from "../utils/builders.js";

/** Configuración de includes para consultas de cuentas */
const cuentaIncludes = [
  { model: TipoCuentaModel, as: "tipoCuenta" },
  { model: EstadoCuentaModel, as: "estadoCuenta" },
  {
    model: CasaMatrizModel,
    as: "clientesAutorizados",
    attributes: [
      "id",
      "razonSocial",
      "rut",
      "servicios",
      "banco",
      "tipoCuentaBancaria",
      "numeroCuentaBancaria",
      "titularCuenta",
      "rutTitularCuenta",
      "correoNotificacionPago",
    ],
    through: { attributes: [] },
  },
];

/**
 * Crea o actualiza una cuenta de usuario.
 * POST /crear-modificar-cuenta
 */
export const postCuenta = async (req, res) => {
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
    haveTickets,
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

      if (tipoCuentaFinal === 4) {
        updates.haveTickets = parseBooleanFlag(haveTickets, cuenta.haveTickets);
      } else if (tipoCuentaFinal === 1 || tipoCuentaFinal === 2) {
        updates.haveTickets = true;
      } else {
        updates.haveTickets = false;
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
      return res.json({ error: "Correo electrónico ya registrado." });
    }

    if (!password || password.trim() === "") {
      return res.status(400).json({ error: "La contraseña es obligatoria." });
    }

    console.log("Password received for creation:", password);
    console.log("Password length:", password.length);

    if (tipoCuentaNumero === undefined || Number.isNaN(tipoCuentaNumero)) {
      return res.status(400).json({ error: "Tipo de cuenta inválido." });
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
        tipoCuentaNumero === 1 ? parseBooleanFlag(esTecnico, false) : false,
      haveTickets:
        tipoCuentaNumero === 4
          ? parseBooleanFlag(haveTickets, false)
          : [1, 2].includes(tipoCuentaNumero)
          ? true
          : false,
    });

    if (tipoCuentaNumero === 4) {
      await nuevaCuenta.setClientesAutorizados(clienteIds);
    }

    // LOG
    await registrarLog(
      req.usuario?.id,
      "CREAR_USUARIO",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { nuevoUsuarioId: nuevaCuenta.id, email: nuevaCuenta.email }
    );

    const cuentaConAsociaciones = await CuentaModel.scope(
      "eliminarCampos"
    ).findByPk(nuevaCuenta.id, {
      include: cuentaIncludes,
    });

    return res.json(cuentaConAsociaciones);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al procesar la cuenta." });
  }
};

/**
 * Obtiene lista de técnicos disponibles (activos).
 * GET /tecnicos
 */
export const getTecnicosDisponibles = async (_req, res) => {
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
      attributes: [
        "id",
        "name",
        "email",
        "tipoCuentaId",
        "esTecnico",
        "haveTickets",
      ],
      order: [["name", "ASC"]],
    });

    return res.json(tecnicos);
  } catch (error) {
    console.error("Error al obtener técnicos disponibles:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener el listado de técnicos." });
  }
};

/**
 * Verifica si un correo ya está registrado.
 * GET /verificar-correo?correo=...
 */
export const getVerificarCorreo = async (req, res) => {
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

/**
 * Modifica datos básicos de una cuenta.
 * POST /modificar-cuenta/:id
 * @deprecated Usar postCuenta con id en body en su lugar
 */
export const postModificarCuenta = async (req, res) => {
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

/**
 * Elimina una cuenta de usuario.
 * GET /eliminar-cuenta/:id
 */
export const getEliminarCuenta = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.json({ resp: "No se ha encontrado un identificador unico" });
  }

  const cuenta = await CuentaModel.findByPk(id);

  if (!cuenta) {
    return res.json({ resp: "Cliente no encontrado, intente nuevamente" });
  }

  await cuenta.destroy();

  // LOG
  await registrarLog(
    req.usuario?.id,
    "ELIMINAR_USUARIO",
    req.method,
    req.path,
    req.ip || req.connection.remoteAddress,
    { usuarioEliminadoId: id }
  );

  return res.json({ resp: "Cliente eliminado correctamente" });
};

/**
 * Lista usuarios paginados con filtro por tipo de cuenta y búsqueda por nombre.
 * GET /usuarios?pagina=1&option=Administrador&buscar=Juan
 */
export const getUsuarios = async (req, res) => {
  let paginaActual = parseInt(req.query.pagina);
  const expresion = /^[1-999]$/;

  if (!expresion.test(paginaActual)) {
    paginaActual = 1;
  }

  // Limites y Offset para el paginador
  const limit = 12;
  const offset = (paginaActual - 1) * limit;

  const { option, buscar } = req.query;
  let tipoCuentaFiltro = { [Op.in]: [1, 2, 3, 4, 5] };
  if (option === "Mesa de ayuda") {
    tipoCuentaFiltro = 3;
  } else if (option === "Técnico de soporte") {
    tipoCuentaFiltro = 2;
  } else if (option === "Administrador") {
    tipoCuentaFiltro = 1;
  } else if (option === "Cliente") {
    tipoCuentaFiltro = 4;
  } else if (option === "Comercial") {
    tipoCuentaFiltro = 5;
  }

  const where = { tipoCuentaId: tipoCuentaFiltro };

  // Agregar búsqueda por nombre si se proporciona
  if (buscar && buscar.trim()) {
    where.name = { [Op.like]: `%${buscar.trim()}%` };
  }

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

/**
 * Obtiene un usuario por su ID.
 * GET /usuario/:id
 */
export const getUsuario = async (req, res) => {
  const { id } = req.params;

  const usuario = await CuentaModel.scope("eliminarCampos").findByPk(id, {
    include: cuentaIncludes,
  });

  if (!usuario) {
    return res.status(404).json({ error: "Cuenta no encontrada." });
  }

  return res.json(usuario);
};

/**
 * Obtiene el perfil del usuario autenticado.
 * GET /perfil
 */
export const getPerfil = async (req, res) => {
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

    const perfilPlano = perfil?.toJSON ? perfil.toJSON() : perfil;
    if (perfilPlano) {
      const incluirDatosBancarios = perfilPlano.tipoCuentaId === 4;
      perfilPlano.clientesAutorizados = (
        perfilPlano.clientesAutorizados ?? []
      ).map(
        (cliente) =>
          transformarClienteRespuesta(cliente, {
            incluirDatosBancarios,
          }) ?? cliente
      );
    }

    return res.json(perfilPlano);
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener el perfil del usuario." });
  }
};

/**
 * Actualiza el perfil del usuario autenticado.
 * PUT /perfil
 */
export const actualizarPerfil = async (req, res) => {
  try {
    const cuentaSesion = req.usuario;
    if (!cuentaSesion) {
      return res.status(401).json({ error: "Sesion no valida." });
    }

    const cuenta = await CuentaModel.findByPk(cuentaSesion.id);
    if (!cuenta) {
      return res.status(404).json({ error: "Cuenta no encontrada." });
    }

    const { name, telefono, email, passwordActual, nuevoPassword } =
      req.body ?? {};

    const esCliente = cuenta.tipoCuentaId === 4;

    const telefonoParsed =
      telefono !== undefined && telefono !== null && telefono !== ""
        ? Number.parseInt(telefono, 10)
        : undefined;

    if (
      esCliente &&
      ((name && name.trim() !== cuenta.name) ||
        (email && email.trim() !== cuenta.email) ||
        (telefonoParsed !== undefined &&
          Number.isFinite(telefonoParsed) &&
          cuenta.telefono !== telefonoParsed))
    ) {
      return res.status(403).json({
        error: "Los clientes solo pueden actualizar su contrasena.",
      });
    }

    if (!esCliente && email && email !== cuenta.email) {
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

    if (!esCliente && name) {
      cuenta.name = name.trim();
    }

    if (!esCliente) {
      if (telefonoParsed !== undefined && Number.isFinite(telefonoParsed)) {
        cuenta.telefono = telefonoParsed;
      } else if (telefono === "" || telefono === null) {
        cuenta.telefono = null;
      }
    }

    if (nuevoPassword) {
      if (!passwordActual) {
        return res.status(400).json({
          error:
            "Debes proporcionar la contrasena actual para realizar el cambio.",
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

    const perfilPlano = perfilActualizado?.toJSON
      ? perfilActualizado.toJSON()
      : perfilActualizado;
    if (perfilPlano) {
      const incluirDatosBancarios = perfilPlano.tipoCuentaId === 4;
      perfilPlano.clientesAutorizados = (
        perfilPlano.clientesAutorizados ?? []
      ).map(
        (cliente) =>
          transformarClienteRespuesta(cliente, {
            incluirDatosBancarios,
          }) ?? cliente
      );
    }

    return res.json({
      mensaje: "Perfil actualizado correctamente.",
      perfil: perfilPlano,
    });
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el perfil del usuario." });
  }
};

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
