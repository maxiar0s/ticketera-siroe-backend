/**
 * @fileoverview Controlador de tickets.
 * Maneja CRUD de tickets con asignación de técnicos y estados.
 */

import { Op } from "sequelize";
import db from "../config/db.js";
import {
  CasaMatrizModel,
  CuentaCasaMatrizModel,
  CuentaModel,
  NotificacionModel,
  ProyectoModel,
  SucursalModel,
  TicketModel,
  TagModel,
  TicketTagModel,
} from "../models/index.js";
import registrarLog from "../utils/logger.js";
import {
  parseBooleanFlag,
  parseIdArray,
  parseStringArray,
  parseEstadoTicket,
} from "../utils/parsers.js";
import {
  isValidDateValue,
  toISODateOnly,
  limpiarDetalleTermino,
} from "../utils/validators.js";
import { construirNotificacionTicket } from "../utils/builders.js";
import { registrarActividadTicket } from "./chatController.js";

const ESTADO_TICKET_INGRESADO = "Ingresado";

// =====================================================
// Includes para queries
// =====================================================

const ticketIncludes = [
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
  { model: CuentaModel, as: "creadoPor", attributes: ["id", "name"] },
  { model: CuentaModel, as: "actualizadoPor", attributes: ["id", "name"] },
  { model: CuentaModel, as: "tecnicoAsignado", attributes: ["id", "name"] },
  { model: ProyectoModel, as: "proyecto", attributes: ["id", "nombre"] },
  {
    model: TagModel,
    as: "tags",
    attributes: ["id", "nombre", "color"],
    through: { attributes: [] },
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

const crearNotificacionesAsignacionTicket = async (
  ticket,
  cuentaIds,
  asignadoPorId
) => {
  if (!ticket || !Array.isArray(cuentaIds) || cuentaIds.length === 0) return;
  const idsUnicos = Array.from(
    new Set(cuentaIds.filter((id) => Number.isInteger(id) && id > 0))
  );
  if (!idsUnicos.length) return;

  const datos = construirNotificacionTicket(ticket);
  const referenciaTipo = "ticket";
  const ahora = new Date();

  await Promise.all(
    idsUnicos.map(async (cuentaId) => {
      const [registro, creado] = await NotificacionModel.findOrCreate({
        where: { cuentaId, referenciaId: ticket.id, referenciaTipo },
        defaults: {
          cuentaId,
          tipo: referenciaTipo,
          titulo: datos.titulo,
          mensaje: datos.mensaje,
          referenciaId: ticket.id,
          referenciaTipo,
          metadata: { ...datos.metadata, referenciaTipo },
          leida: false,
          createdAt: ahora,
          updatedAt: ahora,
        },
      });
      if (!creado) {
        await registro.update(
          {
            titulo: datos.titulo,
            mensaje: datos.mensaje,
            metadata: { ...datos.metadata, referenciaTipo },
            updatedAt: ahora,
          },
          { hooks: false }
        );
      }
    })
  );
};

const normalizarNombreTecnico = (valor) => {
  if (typeof valor !== "string") return "";
  return valor.trim().toLowerCase();
};

/**
 * Verifica si un técnico tiene acceso a un ticket.
 * Un técnico tiene acceso si:
 * - El ticket está en estado "Nuevo" (sin asignar)
 * - Es el técnico actualmente asignado
 * - Está en el historial de transferencias del ticket
 */
const tecnicoTieneAccesoAlTicket = (usuarioId, ticket) => {
  if (!ticket) return false;

  // Tickets nuevos (sin asignar) son accesibles para todos los técnicos
  if (ticket.estadoTicket === "Nuevo" || !ticket.tecnicoAsignadoId) {
    return true;
  }

  // Es el técnico actualmente asignado
  if (ticket.tecnicoAsignadoId === usuarioId) {
    return true;
  }

  // Está en el historial de transferencias
  let historial = [];
  if (Array.isArray(ticket.historialTransferencias)) {
    historial = ticket.historialTransferencias;
  } else if (
    typeof ticket.historialTransferencias === "string" &&
    ticket.historialTransferencias.trim() !== ""
  ) {
    try {
      historial = JSON.parse(ticket.historialTransferencias);
    } catch (e) {
      historial = [];
    }
  }

  // Buscar si el usuario estuvo involucrado en alguna transferencia
  for (const transferencia of historial) {
    if (
      transferencia.fromId === usuarioId ||
      transferencia.toId === usuarioId
    ) {
      return true;
    }
  }

  return false;
};

// =====================================================
// Endpoints
// =====================================================

/**
 * Lista tickets con paginación y filtros.
 * GET /tickets
 */
export const getTickets = async (req, res) => {
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
      estado,
      tecnicoId,
      sinAsignar,
      tagIds,
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
        return res.status(400).json({
          error: "El identificador del proyecto indicado no es valido.",
        });
      }
      where.proyectoId = proyectoIdNumero;
    } else if (parseBooleanFlag(sinProyecto, false)) {
      where.proyectoId = null;
    }

    if (estado) {
      const estadoNormalizado = parseEstadoTicket(estado, null);
      if (estadoNormalizado) {
        where.estadoTicket = estadoNormalizado;
      }
    }

    // Filtro por técnico asignado
    if (parseBooleanFlag(sinAsignar, false)) {
      // Filtrar tickets sin técnico asignado (estado Nuevo)
      where.tecnicoAsignadoId = null;
    } else if (tecnicoId) {
      const tecnicoIdNumero = Number.parseInt(`${tecnicoId}`, 10);
      if (Number.isInteger(tecnicoIdNumero) && tecnicoIdNumero > 0) {
        where.tecnicoAsignadoId = tecnicoIdNumero;
      }
    }

    // Filtro por tags
    let ticketIdsConTags = null;
    if (tagIds) {
      const tagIdsParsed = parseIdArray(tagIds);
      if (tagIdsParsed.length > 0) {
        const ticketsConTags = await TicketTagModel.findAll({
          where: { tagId: { [Op.in]: tagIdsParsed } },
          attributes: ["ticketId"],
          raw: true,
        });
        ticketIdsConTags = [...new Set(ticketsConTags.map((t) => t.ticketId))];
        if (ticketIdsConTags.length === 0) {
          return res.json({
            data: [],
            total: 0,
            pagina: pageNumber,
            paginasTotales: 0,
          });
        }
        where.id = { [Op.in]: ticketIdsConTags };
      }
    }

    const esTecnico = usuario && usuario.tipoCuentaId === 2;

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
        return res.status(403).json({
          error: "No tiene permisos para ver los tickets de este cliente.",
        });
      }
      if (!clienteId) {
        where.casaMatrizId = { [Op.in]: autorizados };
      }
    }

    // Para técnicos: filtrar por tickets accesibles
    // Un técnico puede ver: tickets Nuevos, asignados a él, o donde esté en historial
    let ticketsAccesiblesIds = null;
    if (esTecnico && !parseBooleanFlag(sinAsignar, false)) {
      // Si hay filtro de tecnicoId específico, no sobreescribir
      // Solo aplicar restricción si no hay filtro específico de tecnicoId
      if (!tecnicoId) {
        // Buscar todos los tickets donde el técnico tiene acceso
        const todosTickets = await TicketModel.findAll({
          attributes: [
            "id",
            "estadoTicket",
            "tecnicoAsignadoId",
            "historialTransferencias",
          ],
          raw: true,
        });

        ticketsAccesiblesIds = todosTickets
          .filter((t) => {
            // Tickets nuevos
            if (t.estadoTicket === "Nuevo" || !t.tecnicoAsignadoId) {
              return true;
            }
            // Asignado al usuario
            if (t.tecnicoAsignadoId === usuario.id) {
              return true;
            }
            // En historial de transferencias
            let historial = [];
            if (t.historialTransferencias) {
              try {
                historial = JSON.parse(t.historialTransferencias);
              } catch (e) {
                historial = [];
              }
            }
            for (const transferencia of historial) {
              if (
                transferencia.fromId === usuario.id ||
                transferencia.toId === usuario.id
              ) {
                return true;
              }
            }
            return false;
          })
          .map((t) => t.id);

        if (ticketsAccesiblesIds.length === 0) {
          return res.json({
            data: [],
            total: 0,
            pagina: pageNumber,
            paginasTotales: 0,
          });
        }

        where.id = { [Op.in]: ticketsAccesiblesIds };
      }
    }

    const { rows, count } = await TicketModel.findAndCountAll({
      where,
      include: ticketIncludes,
      order: [
        // Ordenar tickets "Nuevo" primero
        [
          db.literal(`CASE WHEN estadoTicket = 'Nuevo' THEN 0 ELSE 1 END`),
          "ASC",
        ],
        ["fechaVisita", "DESC"],
        ["createdAt", "DESC"],
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
    console.error("Error al obtener tickets:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los tickets." });
  }
};

/**
 * Obtiene un ticket por ID.
 * GET /tickets/:id
 */
export const getTicketById = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;

    const ticket = await TicketModel.findByPk(id, { include: ticketIncludes });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket no encontrado." });
    }

    // Validación para clientes
    if (usuario.tipoCuentaId === 4) {
      const autorizados = await getAuthorizedClientIds(usuario.id);
      if (!autorizados.includes(ticket.casaMatrizId)) {
        return res
          .status(403)
          .json({ error: "No tiene permisos para ver el ticket solicitado." });
      }
    }

    // Validación para técnicos
    if (usuario.tipoCuentaId === 2) {
      if (!tecnicoTieneAccesoAlTicket(usuario.id, ticket)) {
        return res
          .status(403)
          .json({ error: "No tiene permisos para ver este ticket." });
      }
    }

    return res.json(ticket);
  } catch (error) {
    console.error("Error al obtener el ticket:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener el ticket." });
  }
};

/**
 * Crea un nuevo ticket.
 * POST /tickets
 */
export const crearTicket = async (req, res) => {
  try {
    const usuario = req.usuario;

    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para crear tickets." });
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
      fechaVisita,
      horaLlegada,
      horaSalida,
      tecnicos,
      descripcion,
      titulo,
      isEmergencia,
      estadoTicket: estadoTicketEntrada,
      ticketEstado,
      fechaTermino,
      detalleTermino,
      ticketFechaTermino,
      ticketDetalleTermino,
      proyectoId,
      prioridad,
      tipo,
      tagIds,
    } = bodyData;

    if (!casaMatrizId || !fechaVisita) {
      return res.status(400).json({
        error: "Los campos casaMatrizId y fechaVisita son obligatorios.",
      });
    }

    if (!isValidDateValue(fechaVisita)) {
      return res
        .status(400)
        .json({ error: "La fecha de ingreso no es valida." });
    }

    const descripcionLimpia = descripcion ? `${descripcion}`.trim() : "";
    if (!descripcionLimpia) {
      return res
        .status(400)
        .json({ error: "La nota del ticket no puede estar vacia." });
    }

    const estadoEntrada =
      typeof estadoTicketEntrada !== "undefined"
        ? estadoTicketEntrada
        : typeof ticketEstado !== "undefined"
        ? ticketEstado
        : null;
    const estadoTicketNormalizado = parseEstadoTicket(
      estadoEntrada,
      ESTADO_TICKET_INGRESADO
    );

    const fechaTerminoEntrada =
      typeof fechaTermino !== "undefined" ? fechaTermino : ticketFechaTermino;
    const detalleTerminoEntrada =
      typeof detalleTermino !== "undefined"
        ? detalleTermino
        : ticketDetalleTermino;

    let fechaTerminoNormalizada = null;
    let detalleTerminoNormalizado = null;

    if (
      estadoTicketNormalizado === "Resuelto" ||
      estadoTicketNormalizado === "Cerrado"
    ) {
      const fechaNormalizada = toISODateOnly(fechaTerminoEntrada);
      if (!fechaNormalizada) {
        return res
          .status(400)
          .json({ error: "La fecha de termino del ticket es obligatoria." });
      }
      const detalleLimpio = limpiarDetalleTermino(detalleTerminoEntrada);
      if (!detalleLimpio) {
        return res.status(400).json({
          error:
            "Debes indicar el detalle de lo realizado para cerrar el ticket.",
        });
      }
      fechaTerminoNormalizada = fechaNormalizada;
      detalleTerminoNormalizado = detalleLimpio;
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

    if (llegadaDate && salidaDate && salidaDate < llegadaDate) {
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
    let tecnicoAsignadoId = null;

    if (tecnicosArray.length > 0) {
      const nombreAsignado = tecnicosArray[0];
      const ids = await obtenerCuentaIdsPorNombres([nombreAsignado]);
      if (ids.length > 0) {
        tecnicoAsignadoId = ids[0];
      }
    }

    if (estadoTicketNormalizado === "Nuevo") {
      tecnicoAsignadoId = null;
      tecnicosArray.length = 0;
    } else {
      if (tecnicosArray.length === 0) {
        return res.status(400).json({
          error:
            "Debe indicar al menos un tecnico responsable para tickets que no sean Nuevos.",
        });
      }
    }

    const tecnicosIdsAsignados = await extraerIdsTecnicosAsignacion(
      bodyData,
      tecnicosArray
    );

    const nuevoTicket = await TicketModel.create({
      casaMatrizId,
      sucursalId: sucursal ? sucursal.id : null,
      fechaVisita,
      horaLlegada: llegadaDate,
      horaSalida: salidaDate,
      tecnicos: tecnicosArray,
      tecnicoAsignadoId,
      descripcion: descripcionLimpia,
      titulo: titulo ? `${titulo}`.trim() || null : null,
      creadoPorId: usuario.id,
      actualizadoPorId: usuario.id,
      proyectoId: proyectoSeleccionado ? proyectoSeleccionado.id : null,
      isEmergencia: parseBooleanFlag(isEmergencia, false),
      estadoTicket: estadoTicketNormalizado ?? ESTADO_TICKET_INGRESADO,
      fechaTermino: fechaTerminoNormalizada,
      detalleTermino: detalleTerminoNormalizado,
      adjuntos: Array.isArray(req.uploadedFiles) ? req.uploadedFiles : [],
      adjuntosTermino: Array.isArray(req.uploadedEvidenceFiles)
        ? req.uploadedEvidenceFiles
        : [],
      prioridad: prioridad ?? "Media",
      tipo: tipo ?? "Incidente",
    });

    // Asignar tags si se proporcionaron
    const tagIdsParsed = parseIdArray(tagIds);
    if (tagIdsParsed.length > 0) {
      // Verificar que los tags pertenecen al cliente
      const tagsValidos = await TagModel.findAll({
        where: {
          id: { [Op.in]: tagIdsParsed },
          casaMatrizId: casaMatrizId,
        },
        attributes: ["id"],
      });
      const idsValidos = tagsValidos.map((t) => t.id);
      if (idsValidos.length > 0) {
        await TicketTagModel.bulkCreate(
          idsValidos.map((tagId) => ({ ticketId: nuevoTicket.id, tagId })),
          { ignoreDuplicates: true }
        );
      }
    }

    const ticketCreado = await TicketModel.findByPk(nuevoTicket.id, {
      include: ticketIncludes,
    });

    let idsParaNotificar = [];
    if (tecnicosIdsAsignados && tecnicosIdsAsignados.length > 0) {
      idsParaNotificar = tecnicosIdsAsignados;
    } else if (tecnicoAsignadoId) {
      idsParaNotificar = [tecnicoAsignadoId];
    }

    if (idsParaNotificar.length > 0) {
      await crearNotificacionesAsignacionTicket(
        ticketCreado,
        idsParaNotificar,
        usuario.id
      );
    }

    // LOG
    await registrarLog(
      usuario.id,
      "CREAR_TICKET",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { ticketId: ticketCreado.id, clienteId: casaMatrizId }
    );

    return res.status(201).json(ticketCreado);
  } catch (error) {
    console.error("Error al crear ticket:", error);
    return res.status(500).json({ error: "Hubo un error al crear el ticket." });
  }
};

/**
 * Actualiza un ticket.
 * PUT /tickets/:id
 */
export const actualizarTicket = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;

    if (![1, 2].includes(usuario.tipoCuentaId)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para modificar tickets." });
    }

    const ticket = await TicketModel.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket no encontrado." });
    }

    // Validación de permisos para técnicos
    if (usuario.tipoCuentaId === 2) {
      if (!tecnicoTieneAccesoAlTicket(usuario.id, ticket)) {
        return res
          .status(403)
          .json({ error: "No tiene permisos para modificar este ticket." });
      }
    }

    const tecnicosPrevios = Array.isArray(ticket.tecnicos)
      ? ticket.tecnicos
          .map((item) => `${item}`.trim())
          .filter((item) => item.length > 0)
      : [];
    let idsAsignacionEntrada = null;

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
      fechaVisita,
      horaLlegada,
      horaSalida,
      tecnicos,
      descripcion,
      titulo,
      isEmergencia,
      estadoTicket,
      fechaTermino,
      ticketFechaTermino,
      detalleTermino,
      ticketDetalleTermino,
      prioridad,
      tipo,
      comentarioInterno,
      tiempoResolucion,
      tagIds,
    } = bodyData;

    let proyectoCambioSolicitado = false;
    let proyectoIdFinal = ticket.proyectoId;

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
      const comentarioDefinido = typeof comentarioInterno !== "undefined";
      const tiempoDefinido = typeof tiempoResolucion !== "undefined";
      const estadoDefinido = typeof estadoTicket !== "undefined";
      const tecnicosDefinido = typeof tecnicos !== "undefined";
      const tituloDefinido = typeof titulo !== "undefined";

      if (
        !descripcionDefinida &&
        !proyectoCambioSolicitado &&
        !comentarioDefinido &&
        !tiempoDefinido &&
        !estadoDefinido &&
        !tecnicosDefinido &&
        !tituloDefinido
      ) {
        return res.status(400).json({
          error: "El tecnico no proporciono campos validos para actualizar.",
        });
      }

      if (descripcionDefinida) {
        const descripcionLimpia = `${descripcion ?? ""}`.trim();
        if (!descripcionLimpia) {
          return res
            .status(400)
            .json({ error: "La nota del ticket no puede estar vacia." });
        }
        cambios.descripcion = descripcionLimpia;
      }

      // Permitir que técnicos cambien título
      if (tituloDefinido) {
        const tituloLimpio = `${titulo ?? ""}`.trim();
        cambios.titulo = tituloLimpio.length > 0 ? tituloLimpio : null;
      }

      // Permitir que técnicos cambien estado del ticket
      if (estadoDefinido) {
        const estadoNormalizado = parseEstadoTicket(estadoTicket, null);
        if (estadoNormalizado) {
          cambios.estadoTicket = estadoNormalizado;
        }
      }

      // Permitir que técnicos asignen técnicos (primera asignación o tickets a los que tienen acceso)
      if (tecnicosDefinido) {
        const tecnicosArray = parseStringArray(tecnicos);
        let nuevoTecnicoAsignadoId = null;

        if (tecnicosArray.length > 0) {
          const nombreAsignado = tecnicosArray[0];
          const ids = await obtenerCuentaIdsPorNombres([nombreAsignado]);
          if (ids.length > 0) {
            nuevoTecnicoAsignadoId = ids[0];
          }
        }

        const estadoFinal = cambios.estadoTicket || ticket.estadoTicket;

        if (estadoFinal === "Nuevo") {
          cambios.tecnicoAsignadoId = null;
          cambios.tecnicos = [];
        } else {
          if (!nuevoTecnicoAsignadoId && !ticket.tecnicoAsignadoId) {
            return res.status(400).json({
              error:
                "Debe asignar un tecnico al cambiar el estado de un ticket Nuevo.",
            });
          }

          if (tecnicosArray.length === 0) {
            return res.status(400).json({
              error: "No se puede dejar sin tecnico un ticket en curso.",
            });
          }

          // Registrar historial de transferencia si cambia el técnico asignado
          if (
            nuevoTecnicoAsignadoId &&
            ticket.tecnicoAsignadoId &&
            ticket.tecnicoAsignadoId !== nuevoTecnicoAsignadoId
          ) {
            let historial = [];
            if (Array.isArray(ticket.historialTransferencias)) {
              historial = [...ticket.historialTransferencias];
            } else if (
              typeof ticket.historialTransferencias === "string" &&
              ticket.historialTransferencias.trim() !== ""
            ) {
              try {
                historial = JSON.parse(ticket.historialTransferencias);
              } catch (e) {
                historial = [];
              }
            }
            historial.push({
              fromId: ticket.tecnicoAsignadoId,
              toId: nuevoTecnicoAsignadoId,
              date: new Date().toISOString(),
              by: usuario.id,
            });
            cambios.historialTransferencias = historial;
          }

          cambios.tecnicos = tecnicosArray;
          if (nuevoTecnicoAsignadoId) {
            cambios.tecnicoAsignadoId = nuevoTecnicoAsignadoId;
          }

          idsAsignacionEntrada = await extraerIdsTecnicosAsignacion(
            bodyData,
            tecnicosArray
          );
        }
      }
    } else if (usuario.tipoCuentaId === 1) {
      if (typeof descripcion !== "undefined") {
        const descripcionLimpia = `${descripcion ?? ""}`.trim();
        if (!descripcionLimpia) {
          return res
            .status(400)
            .json({ error: "La nota del ticket no puede estar vacia." });
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
            .json({ error: "El cliente del ticket no puede quedar vacio." });
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
            .json({ error: "La fecha del ticket no es valida." });
        }
        cambios.fechaVisita = fechaVisita;
      }

      if (typeof horaLlegada !== "undefined") {
        if (!horaLlegada) {
          cambios.horaLlegada = null;
        } else {
          if (!isValidDateValue(horaLlegada)) {
            return res.status(400).json({
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
            return res.status(400).json({
              error: "La hora de salida debe tener un formato valido.",
            });
          }
          cambios.horaSalida = new Date(horaSalida);
        }
      }

      if (typeof tecnicos !== "undefined") {
        const tecnicosArray = parseStringArray(tecnicos);
        let nuevoTecnicoAsignadoId = null;

        if (tecnicosArray.length > 0) {
          const nombreAsignado = tecnicosArray[0];
          const ids = await obtenerCuentaIdsPorNombres([nombreAsignado]);
          if (ids.length > 0) {
            nuevoTecnicoAsignadoId = ids[0];
          }
        }

        const estadoFinal = cambios.estadoTicket || ticket.estadoTicket;

        if (estadoFinal === "Nuevo") {
          cambios.tecnicoAsignadoId = null;
          cambios.tecnicos = [];
          tecnicosArray.length = 0;
          nuevoTecnicoAsignadoId = null;
        } else {
          if (!nuevoTecnicoAsignadoId && !ticket.tecnicoAsignadoId) {
            return res.status(400).json({
              error:
                "Debe asignar un tecnico al cambiar el estado de un ticket Nuevo.",
            });
          }
        }

        if (tecnicosArray.length === 0 && estadoFinal !== "Nuevo") {
          return res.status(400).json({
            error: "No se puede dejar sin tecnico un ticket en curso.",
          });
        }

        if (
          nuevoTecnicoAsignadoId &&
          ticket.tecnicoAsignadoId &&
          ticket.tecnicoAsignadoId !== nuevoTecnicoAsignadoId
        ) {
          let historial = [];
          if (Array.isArray(ticket.historialTransferencias)) {
            historial = [...ticket.historialTransferencias];
          } else if (
            typeof ticket.historialTransferencias === "string" &&
            ticket.historialTransferencias.trim() !== ""
          ) {
            try {
              historial = JSON.parse(ticket.historialTransferencias);
            } catch (e) {
              historial = [];
            }
          }
          historial.push({
            fromId: ticket.tecnicoAsignadoId,
            toId: nuevoTecnicoAsignadoId,
            date: new Date().toISOString(),
            by: usuario.id,
          });
          cambios.historialTransferencias = historial;
        }

        cambios.tecnicos = tecnicosArray;
        if (nuevoTecnicoAsignadoId) {
          cambios.tecnicoAsignadoId = nuevoTecnicoAsignadoId;
        }

        idsAsignacionEntrada = await extraerIdsTecnicosAsignacion(
          bodyData,
          tecnicosArray
        );
      }

      if (typeof isEmergencia !== "undefined") {
        cambios.isEmergencia = parseBooleanFlag(
          isEmergencia,
          ticket.isEmergencia
        );
      }

      const tieneEstadoTicketEntrada =
        Object.prototype.hasOwnProperty.call(bodyData, "estadoTicket") ||
        Object.prototype.hasOwnProperty.call(bodyData, "ticketEstado");
      if (tieneEstadoTicketEntrada) {
        const estadoEntrada =
          typeof estadoTicket !== "undefined"
            ? estadoTicket
            : bodyData.ticketEstado;
        const estadoNormalizado = parseEstadoTicket(estadoEntrada, null);
        if (estadoNormalizado) {
          cambios.estadoTicket = estadoNormalizado;
        }
      }

      if (typeof prioridad !== "undefined") {
        const prioridadLimpia = `${prioridad ?? ""}`.trim();
        if (prioridadLimpia) cambios.prioridad = prioridadLimpia;
      }

      if (typeof tipo !== "undefined") {
        const tipoLimpio = `${tipo ?? ""}`.trim();
        if (tipoLimpio) cambios.tipo = tipoLimpio;
      }

      const tieneFechaTerminoEntrada =
        Object.prototype.hasOwnProperty.call(bodyData, "fechaTermino") ||
        Object.prototype.hasOwnProperty.call(bodyData, "ticketFechaTermino");
      if (tieneFechaTerminoEntrada) {
        const entradaFecha = Object.prototype.hasOwnProperty.call(
          bodyData,
          "fechaTermino"
        )
          ? bodyData.fechaTermino
          : bodyData.ticketFechaTermino;
        if (entradaFecha) {
          const fechaNormalizada = toISODateOnly(entradaFecha);
          if (!fechaNormalizada) {
            return res
              .status(400)
              .json({ error: "La fecha de termino del ticket no es valida." });
          }
          cambios.fechaTermino = fechaNormalizada;
        } else {
          cambios.fechaTermino = null;
        }
      }

      const tieneDetalleTerminoEntrada =
        Object.prototype.hasOwnProperty.call(bodyData, "detalleTermino") ||
        Object.prototype.hasOwnProperty.call(bodyData, "ticketDetalleTermino");
      if (tieneDetalleTerminoEntrada) {
        const entradaDetalle = Object.prototype.hasOwnProperty.call(
          bodyData,
          "detalleTermino"
        )
          ? bodyData.detalleTermino
          : bodyData.ticketDetalleTermino;
        const detalleLimpio = limpiarDetalleTermino(entradaDetalle);
        cambios.detalleTermino =
          detalleLimpio.length > 0 ? detalleLimpio : null;
      }

      if (typeof sucursalId !== "undefined") {
        if (!sucursalId) {
          cambios.sucursalId = null;
        } else {
          const sucursal = await SucursalModel.findByPk(sucursalId);
          if (!sucursal) {
            return res.status(404).json({ error: "Sucursal no encontrada." });
          }
          const clienteDestino = cambios.casaMatrizId ?? ticket.casaMatrizId;
          if (sucursal.casaMatrizId !== clienteDestino) {
            return res.status(400).json({
              error:
                "La sucursal seleccionada no pertenece al cliente indicado.",
            });
          }
          cambios.sucursalId = sucursalId;
        }
      }
    }

    // Campos comunes para Admin y Tecnico
    if (typeof comentarioInterno !== "undefined") {
      const val = `${comentarioInterno ?? ""}`.trim();
      cambios.comentarioInterno = val.length > 0 ? val : null;
    }

    if (typeof tiempoResolucion !== "undefined") {
      if (tiempoResolucion === null || tiempoResolucion === "") {
        cambios.tiempoResolucion = null;
      } else {
        const num = parseFloat(tiempoResolucion);
        if (!isNaN(num) && num >= 0) {
          cambios.tiempoResolucion = num;
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
      : ticket.horaLlegada;
    const horaSalidaFinal = tieneCambio("horaSalida")
      ? cambios.horaSalida
      : ticket.horaSalida;

    if (
      horaLlegadaFinal &&
      horaSalidaFinal &&
      new Date(horaSalidaFinal) < new Date(horaLlegadaFinal)
    ) {
      return res.status(400).json({
        error: "La hora de salida debe ser posterior a la hora de llegada.",
      });
    }

    const estadoTicketFinal = tieneCambio("estadoTicket")
      ? cambios.estadoTicket
      : parseEstadoTicket(ticket.estadoTicket, ESTADO_TICKET_INGRESADO);

    // Validación: Si el estado final no es "Nuevo", debe tener técnico asignado
    const tecnicoAsignadoIdFinal = tieneCambio("tecnicoAsignadoId")
      ? cambios.tecnicoAsignadoId
      : ticket.tecnicoAsignadoId;

    if (estadoTicketFinal !== "Nuevo" && !tecnicoAsignadoIdFinal) {
      return res.status(400).json({
        error: "Debe asignar un técnico antes de cambiar el estado del ticket.",
      });
    }

    const fechaTerminoFinal = tieneCambio("fechaTermino")
      ? cambios.fechaTermino
      : ticket.fechaTermino;
    const detalleTerminoFinal = tieneCambio("detalleTermino")
      ? cambios.detalleTermino
      : ticket.detalleTermino;

    if (estadoTicketFinal === "Resuelto" || estadoTicketFinal === "Cerrado") {
      if (!fechaTerminoFinal) {
        return res
          .status(400)
          .json({ error: "La fecha de termino del ticket es obligatoria." });
      }
      if (!isValidDateValue(fechaTerminoFinal)) {
        return res
          .status(400)
          .json({ error: "La fecha de termino del ticket no es valida." });
      }
      if (!limpiarDetalleTermino(detalleTerminoFinal)) {
        return res.status(400).json({
          error:
            "Debes indicar el detalle de lo realizado para cerrar el ticket.",
        });
      }
    } else {
      if (tieneCambio("fechaTermino")) cambios.fechaTermino = null;
      if (tieneCambio("detalleTermino")) cambios.detalleTermino = null;
    }

    if (Object.keys(cambios).length === 0) {
      const current = await TicketModel.findByPk(id, {
        include: ticketIncludes,
      });
      return res.json(current);
    }

    // Guardar valores previos ANTES del update para el registro de actividades
    const ticketAntes = {
      estadoTicket: ticket.estadoTicket,
      prioridad: ticket.prioridad,
      tecnicoAsignadoId: ticket.tecnicoAsignadoId,
    };

    cambios.actualizadoPorId = usuario.id;
    await ticket.update(cambios);

    const nuevosAdjuntosIngreso = Array.isArray(req.uploadedFiles)
      ? req.uploadedFiles
      : [];
    const nuevosAdjuntosEvidencia = Array.isArray(req.uploadedEvidenceFiles)
      ? req.uploadedEvidenceFiles
      : [];

    if (nuevosAdjuntosIngreso.length || nuevosAdjuntosEvidencia.length) {
      try {
        if (nuevosAdjuntosIngreso.length) {
          const actualesIngreso = Array.isArray(ticket.adjuntos)
            ? ticket.adjuntos
            : [];
          ticket.adjuntos = actualesIngreso.concat(nuevosAdjuntosIngreso);
        }
        if (nuevosAdjuntosEvidencia.length) {
          const actualesEvidencia = Array.isArray(ticket.adjuntosTermino)
            ? ticket.adjuntosTermino
            : [];
          ticket.adjuntosTermino = actualesEvidencia.concat(
            nuevosAdjuntosEvidencia
          );
        }
        await ticket.save();
      } catch (err) {
        console.error("Error al anexar adjuntos a ticket:", err);
      }
    }
    await ticket.reload({ include: ticketIncludes });

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
        (Array.isArray(ticket.tecnicos) ? ticket.tecnicos : []).map((nombre) =>
          normalizarNombreTecnico(nombre)
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
      await crearNotificacionesAsignacionTicket(
        ticket,
        nuevosIdsNotificacion,
        usuario.id
      );
    }

    // Registrar actividades en el chat timeline
    const ticketDespues = {
      estadoTicket: ticket.estadoTicket,
      prioridad: ticket.prioridad,
      tecnicoAsignadoId: ticket.tecnicoAsignadoId,
    };

    if (
      Object.prototype.hasOwnProperty.call(cambios, "estadoTicket") &&
      cambios.estadoTicket !== ticketAntes.estadoTicket
    ) {
      await registrarActividadTicket({
        ticketId: ticket.id,
        cuentaId: usuario.id,
        tipo: "estado",
        valorAnterior: ticketAntes.estadoTicket || "Nuevo",
        valorNuevo: cambios.estadoTicket,
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(cambios, "prioridad") &&
      cambios.prioridad !== ticketAntes.prioridad
    ) {
      await registrarActividadTicket({
        ticketId: ticket.id,
        cuentaId: usuario.id,
        tipo: "prioridad",
        valorAnterior: ticketAntes.prioridad || "Media",
        valorNuevo: cambios.prioridad,
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(cambios, "tecnicoAsignadoId") &&
      cambios.tecnicoAsignadoId !== ticketAntes.tecnicoAsignadoId
    ) {
      const tecnicoAnterior = ticketAntes.tecnicoAsignadoId
        ? await CuentaModel.findByPk(ticketAntes.tecnicoAsignadoId, {
            attributes: ["name"],
          })
        : null;
      const tecnicoNuevo = cambios.tecnicoAsignadoId
        ? await CuentaModel.findByPk(cambios.tecnicoAsignadoId, {
            attributes: ["name"],
          })
        : null;

      // Usar "asignacion" si es primera asignación, "transferencia" si es cambio entre técnicos
      const tipoActividad = ticketAntes.tecnicoAsignadoId
        ? "transferencia"
        : "asignacion";

      await registrarActividadTicket({
        ticketId: ticket.id,
        cuentaId: usuario.id,
        tipo: tipoActividad,
        valorAnterior: tecnicoAnterior?.name || "Sin asignar",
        valorNuevo: tecnicoNuevo?.name || "Sin asignar",
        metadata: {
          fromId: ticketAntes.tecnicoAsignadoId,
          toId: cambios.tecnicoAsignadoId,
          assignedById: usuario.id,
        },
      });
    }

    // Sincronizar tags si se proporcionaron
    if (Object.prototype.hasOwnProperty.call(bodyData, "tagIds")) {
      const tagIdsParsed = parseIdArray(tagIds);
      // Obtener cliente del ticket
      const clienteIdTicket = ticket.casaMatrizId;

      // Eliminar tags actuales
      await TicketTagModel.destroy({ where: { ticketId: ticket.id } });

      // Agregar nuevos tags (validando que pertenezcan al cliente)
      if (tagIdsParsed.length > 0) {
        const tagsValidos = await TagModel.findAll({
          where: {
            id: { [Op.in]: tagIdsParsed },
            casaMatrizId: clienteIdTicket,
          },
          attributes: ["id"],
        });
        const idsValidos = tagsValidos.map((t) => t.id);
        if (idsValidos.length > 0) {
          await TicketTagModel.bulkCreate(
            idsValidos.map((tagId) => ({ ticketId: ticket.id, tagId })),
            { ignoreDuplicates: true }
          );
        }
      }

      // Recargar ticket con tags actualizados
      await ticket.reload({ include: ticketIncludes });
    }

    // LOG
    await registrarLog(
      usuario.id,
      "MODIFICAR_TICKET",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { ticketId: ticket.id }
    );

    return res.json(ticket);
  } catch (error) {
    console.error("Error al actualizar ticket:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el ticket." });
  }
};

/**
 * Elimina un ticket.
 * DELETE /tickets/:id
 */
export const eliminarTicket = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;

    if (usuario.tipoCuentaId !== 1) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para eliminar tickets." });
    }

    const ticket = await TicketModel.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket no encontrado." });
    }

    await ticket.destroy();

    // LOG
    await registrarLog(
      usuario.id,
      "ELIMINAR_TICKET",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { ticketId: id }
    );

    return res.json({ mensaje: "Ticket eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar ticket:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el ticket." });
  }
};
