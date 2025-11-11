import bcrypt from "bcrypt";
import { col, fn, Op, where as sqlWhere } from "sequelize";
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
  DepartamentoEquipoModel,

  //?estado de equipos
  EstadoEquipoModel,
  //?estado de sucursales
  EstadoSucursalModel,
  VisitaProgramadaModel,
  ProyectoModel,
  ProyectoAdjuntoModel,
  VehiculoModel,
  VehiculoSalidaModel,
  VehiculoSalidaAdjuntoModel,
  VehiculoSalidaTecnicoModel,
  NotificacionModel,
  ClienteDocumentoModel
} from "../models/index.js";
import EstadoCuenta from "../models/EstadoCuenta.js";
import { metodosPago as vehiculoMetodosPago } from "../models/VehiculoSalida.js";
import { CLIENTE_DOCUMENTO_TIPOS } from "../models/ClienteDocumento.js";

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

const DATOS_BANCARIOS_COLUMNAS_DB = [
  "banco",
  "tipoCuentaBancaria",
  "numeroCuentaBancaria",
  "titularCuenta",
  "rutTitularCuenta",
  "correoNotificacionPago",
];

const crearDatosBancariosVacios = () => ({
  banco: null,
  tipoCuenta: null,
  numeroCuenta: null,
  titular: null,
  rutTitular: null,
  correoNotificacion: null,
});

const sanitizarDatoBancario = (valor) => {
  if (valor === null || valor === undefined) {
    return null;
  }
  const texto = typeof valor === "string" ? valor : `${valor}`;
  const trimmed = texto.trim();
  return trimmed.length ? trimmed : null;
};

const normalizarDatosBancariosEntrada = (valor) => {
  if (valor === undefined) {
    return null;
  }

  let origen = valor;

  if (typeof valor === "string") {
    const trimmed = valor.trim();
    if (!trimmed.length) {
      return crearDatosBancariosVacios();
    }
    try {
      origen = JSON.parse(trimmed);
    } catch (_error) {
      return crearDatosBancariosVacios();
    }
  }

  if (!origen || typeof origen !== "object") {
    return crearDatosBancariosVacios();
  }

  return {
    banco: sanitizarDatoBancario(
      origen.banco ?? origen.nombreBanco ?? origen.bancoNombre
    ),
    tipoCuenta: sanitizarDatoBancario(
      origen.tipoCuenta ?? origen.tipoCuentaBancaria
    ),
    numeroCuenta: sanitizarDatoBancario(
      origen.numeroCuenta ??
        origen.numeroCuentaBancaria ??
        origen.cuenta ??
        origen.cuentaBancaria
    ),
    titular: sanitizarDatoBancario(
      origen.titular ?? origen.titularCuenta ?? origen.nombreTitular
    ),
    rutTitular: sanitizarDatoBancario(
      origen.rutTitular ?? origen.rutTitularCuenta
    ),
    correoNotificacion: sanitizarDatoBancario(
      origen.correoNotificacion ??
        origen.correoNotificacionPago ??
        origen.correoPago ??
        origen.correoTransferencia
    ),
  };
};

const obtenerDatosBancariosDesdeBody = (body) => {
  if (!body) {
    return { presente: false, datos: null };
  }

  if (Object.prototype.hasOwnProperty.call(body, "datosBancarios")) {
    return {
      presente: true,
      datos: normalizarDatosBancariosEntrada(body.datosBancarios),
    };
  }

  const candidatos = {
    banco: body?.banco ?? body?.nombreBanco,
    tipoCuenta: body?.tipoCuenta ?? body?.tipoCuentaBancaria,
    numeroCuenta:
      body?.numeroCuenta ?? body?.numeroCuentaBancaria ?? body?.cuenta,
    titular: body?.titular ?? body?.titularCuenta,
    rutTitular: body?.rutTitular ?? body?.rutTitularCuenta,
    correoNotificacion:
      body?.correoNotificacion ?? body?.correoNotificacionPago,
  };

  const tieneAlguno = Object.values(candidatos).some(
    (valor) => valor !== undefined
  );

  if (!tieneAlguno) {
    return { presente: false, datos: null };
  }

  return {
    presente: true,
    datos: normalizarDatosBancariosEntrada(candidatos),
  };
};

const mapearDatosBancariosADB = (datos) => ({
  banco: datos?.banco ?? null,
  tipoCuentaBancaria: datos?.tipoCuenta ?? null,
  numeroCuentaBancaria: datos?.numeroCuenta ?? null,
  titularCuenta: datos?.titular ?? null,
  rutTitularCuenta: datos?.rutTitular ?? null,
  correoNotificacionPago: datos?.correoNotificacion ?? null,
});

const construirDatosBancariosDesdeRegistro = (registro) => {
  if (!registro) {
    return null;
  }

  const origen = registro?.datosBancarios && typeof registro.datosBancarios === "object"
    ? registro.datosBancarios
    : registro;

  const datos = {
    banco: sanitizarDatoBancario(
      origen.banco ?? registro.banco ?? registro.nombreBanco
    ),
    tipoCuenta: sanitizarDatoBancario(
      origen.tipoCuenta ?? registro.tipoCuentaBancaria
    ),
    numeroCuenta: sanitizarDatoBancario(
      origen.numeroCuenta ?? registro.numeroCuentaBancaria
    ),
    titular: sanitizarDatoBancario(
      origen.titular ?? registro.titularCuenta
    ),
    rutTitular: sanitizarDatoBancario(
      origen.rutTitular ?? registro.rutTitularCuenta
    ),
    correoNotificacion: sanitizarDatoBancario(
      origen.correoNotificacion ?? registro.correoNotificacionPago
    ),
  };

  const tieneDatos = Object.values(datos).some((valor) => valor && valor.length);
  return tieneDatos ? datos : null;
};

const removerColumnasDatosBancarios = (objeto) => {
  DATOS_BANCARIOS_COLUMNAS_DB.forEach((columna) => {
    if (objeto && Object.prototype.hasOwnProperty.call(objeto, columna)) {
      delete objeto[columna];
    }
  });
};

const transformarClienteRespuesta = (
  cliente,
  { incluirDatosBancarios = false } = {}
) => {
  if (!cliente) {
    return null;
  }

  const data = cliente?.toJSON ? cliente.toJSON() : cliente;
  const respuesta = {
    ...data,
    servicios: parseStringArray(data.servicios),
  };

  respuesta.datosBancarios = incluirDatosBancarios
    ? construirDatosBancariosDesdeRegistro(data)
    : null;

  removerColumnasDatosBancarios(respuesta);
  return respuesta;
};

const parseIdArray = (value) => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => {
            if (item === null || item === undefined || item === "") {
              return null;
            }
            const numero = Number.parseInt(`${item}`, 10);
            return Number.isNaN(numero) ? null : numero;
          })
          .filter((numero) => Number.isInteger(numero) && numero > 0)
      )
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parseIdArray(parsed);
      }
    } catch (_error) {
      // fallthrough
    }

    if (trimmed.includes(",")) {
      return parseIdArray(
        trimmed
          .split(",")
          .map((fragment) => fragment.trim())
          .filter((fragment) => fragment.length > 0)
      );
    }

    const numero = Number.parseInt(trimmed, 10);
    return Number.isNaN(numero) ? [] : [numero];
  }

  if (typeof value === "number") {
    if (Number.isInteger(value) && value > 0) {
      return [value];
    }
    return [];
  }

  return [];
};

const parseBooleanFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized.length) {
      return defaultValue;
    }

    if (["1", "true", "si", "sí", "yes", "arriendo", "rentado"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "sin arriendo"].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
};

const parseBooleanQueryParam = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const texto = `${value}`.trim();
  if (!texto.length) {
    return null;
  }

  return parseBooleanFlag(texto, false);
};

const parseNumericQueryParam = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const texto = `${value}`.trim();
  if (!texto.length) {
    return null;
  }

  const parsed = Number.parseInt(texto, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const DOCUMENTO_TIPOS_SET = new Set(
  CLIENTE_DOCUMENTO_TIPOS.map((tipo) => tipo.toLowerCase())
);

const normalizarTipoDocumento = (valor) => {
  if (typeof valor !== "string") {
    return null;
  }
  const normalized = valor.trim().toLowerCase();
  if (!normalized.length) {
    return null;
  }
  return DOCUMENTO_TIPOS_SET.has(normalized) ? normalized : null;
};

const cuentaPuedeGestionarDocumentos = (cuenta) =>
  !!cuenta && [1, 5].includes(cuenta.tipoCuentaId);

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

const parseDecimalValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Number(value) : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const parseDateTimeValue = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizarMetodoPagoCombustible = (value) => {
  if (!value) {
    return null;
  }

  if (vehiculoMetodosPago.includes(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const encontrado = vehiculoMetodosPago.find(
      (metodo) => metodo.toLowerCase() === normalized
    );
    return encontrado ?? null;
  }

  return null;
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

const parseTicketFlag = (value, defaultValue = false) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "ticket" || normalized === "tickets") {
      return true;
    }
    if (normalized === "bitacora" || normalized === "bitácora") {
      return false;
    }
  }
  return parseBooleanFlag(value, defaultValue);
};

const ESTADO_TICKET_INGRESADO = "ingresado";
const ESTADO_TICKET_TERMINADO = "terminado";

const parseEstadoTicket = (value, defaultValue = null) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === ESTADO_TICKET_TERMINADO) {
      return ESTADO_TICKET_TERMINADO;
    }
    if (normalized === ESTADO_TICKET_INGRESADO) {
      return ESTADO_TICKET_INGRESADO;
    }
  }
  return defaultValue;
};

const limpiarDetalleTermino = (valor) => {
  if (typeof valor !== "string") {
    return "";
  }
  return valor.trim();
};

const isValidDateValue = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const toISODateOnly = (value) => {
  if (!isValidDateValue(value)) {
    return null;
  }
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
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
  {
    model: ProyectoModel,
    as: "proyecto",
    attributes: ["id", "nombre", "fotoPortada"],
  },
];

const proyectoIncludes = [
  {
    model: ProyectoAdjuntoModel,
    as: "adjuntos",
    include: [
      {
        model: CuentaModel,
        as: "subidoPor",
        attributes: ["id", "name", "email"],
      },
    ],
    separate: true,
    order: [["createdAt", "DESC"]],
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

const vehiculoSalidaIncludes = [
  {
    model: VehiculoSalidaAdjuntoModel,
    as: "adjuntos",
    separate: false,
    order: [["createdAt", "DESC"]],
  },
  {
    model: CuentaModel,
    as: "tecnicos",
    attributes: ["id", "name", "email", "tipoCuentaId"],
    through: { attributes: [] },
  },
];

const vehiculoIncludes = [
  {
    model: VehiculoSalidaModel,
    as: "salidas",
    include: vehiculoSalidaIncludes,
    separate: true,
    order: [["fechaHoraSalida", "DESC"]],
  },
];

const documentoClienteIncludes = [
  {
    model: CasaMatrizModel,
    as: "casaMatriz",
    attributes: ["id", "razonSocial", "rut", "esLead"],
  },
  {
    model: CuentaModel,
    as: "subidoPor",
    attributes: ["id", "name", "email", "tipoCuentaId"],
  },
];

const buildVehiculoSalidaResponse = (salida) => {
  if (!salida) {
    return null;
  }

  const plain = salida.toJSON ? salida.toJSON() : { ...salida };

  plain.adjuntos = Array.isArray(plain.adjuntos)
    ? plain.adjuntos.map((adjunto) =>
        adjunto?.toJSON ? adjunto.toJSON() : { ...adjunto }
      )
    : [];

  plain.tecnicos = Array.isArray(plain.tecnicos)
    ? plain.tecnicos.map((tecnico) =>
        tecnico?.toJSON ? tecnico.toJSON() : { ...tecnico }
      )
    : [];

  return plain;
};

const buildDocumentoClienteResponse = (documento) =>
  documento?.toJSON ? documento.toJSON() : documento;

const buildVehiculoResponse = (vehiculo, opciones = {}) => {
  if (!vehiculo) {
    return null;
  }

  const plain = vehiculo.toJSON ? vehiculo.toJSON() : { ...vehiculo };

  if (Array.isArray(plain.salidas)) {
    const salidasOrdenadas = [...plain.salidas]
      .map((salida) => buildVehiculoSalidaResponse(salida))
      .filter(Boolean);
    salidasOrdenadas.sort((a, b) => {
      const fechaA = new Date(a?.fechaHoraSalida ?? 0).getTime();
      const fechaB = new Date(b?.fechaHoraSalida ?? 0).getTime();
      return fechaB - fechaA;
    });
    plain.salidas = salidasOrdenadas;
  }

  return plain;
};

const buildProyectoResponse = (proyecto, opciones = {}) => {
  if (!proyecto) {
    return null;
  }

  const plain = proyecto.toJSON ? proyecto.toJSON() : { ...proyecto };

  const encargadoIds = Array.isArray(plain.encargados)
    ? plain.encargados
    : parseIdArray(plain.encargados);

  const encargadosMap = opciones.encargadosMap;
  let encargadosDetalle = [];
  if (encargadoIds.length) {
    if (encargadosMap instanceof Map) {
      encargadosDetalle = encargadoIds
        .map((id) => encargadosMap.get(id))
        .filter(Boolean);
    } else {
      encargadosDetalle = encargadoIds.map((id) => ({ id }));
    }
  }

  plain.encargadoIds = encargadoIds;
  plain.encargados = encargadosDetalle;

  const adjuntosPlano = Array.isArray(plain.adjuntos)
    ? plain.adjuntos.map((adjunto) => {
        const item = adjunto?.toJSON ? adjunto.toJSON() : adjunto;
        if (item?.subidoPor && item.subidoPor.toJSON) {
          item.subidoPor = item.subidoPor.toJSON();
        }
        return item;
      })
    : [];
  adjuntosPlano.sort((a, b) => {
    const fechaA = new Date(a?.createdAt ?? 0).getTime();
    const fechaB = new Date(b?.createdAt ?? 0).getTime();
    return fechaB - fechaA;
  });
  plain.adjuntos = adjuntosPlano;

  if (plain.creadoPor && plain.creadoPor.toJSON) {
    plain.creadoPor = plain.creadoPor.toJSON();
  }
  if (plain.actualizadoPor && plain.actualizadoPor.toJSON) {
    plain.actualizadoPor = plain.actualadoPor.toJSON();
  }

  if (opciones.bitacoraCountMap) {
    plain.totalBitacoras = opciones.bitacoraCountMap[plain.id] ?? 0;
  } else if (typeof plain.totalBitacoras !== "number") {
    plain.totalBitacoras = 0;
  }

  if (opciones.ticketCountMap) {
    plain.totalTickets = opciones.ticketCountMap[plain.id] ?? 0;
  } else if (typeof plain.totalTickets !== "number") {
    plain.totalTickets = 0;
  }

  return plain;
};

const obtenerConteosBitacorasPorProyecto = async (proyectoIds) => {
  if (!Array.isArray(proyectoIds) || proyectoIds.length === 0) {
    return {
      bitacoraCountMap: {},
      ticketCountMap: {},
    };
  }

  const bitacoras = await BitacoraModel.findAll({
    attributes: ["proyectoId", [fn("COUNT", col("id")), "total"]],
    where: { proyectoId: { [Op.in]: proyectoIds } },
    group: ["proyectoId"],
    raw: true,
  });

  const tickets = await BitacoraModel.findAll({
    attributes: ["proyectoId", [fn("COUNT", col("id")), "total"]],
    where: { proyectoId: { [Op.in]: proyectoIds }, esTicket: true },
    group: ["proyectoId"],
    raw: true,
  });

  const bitacoraCountMap = bitacoras.reduce((acc, row) => {
    if (row.proyectoId !== null && row.proyectoId !== undefined) {
      acc[row.proyectoId] = Number(row.total) || 0;
    }
    return acc;
  }, {});

  const ticketCountMap = tickets.reduce((acc, row) => {
    if (row.proyectoId !== null && row.proyectoId !== undefined) {
      acc[row.proyectoId] = Number(row.total) || 0;
    }
    return acc;
  }, {});

  return { bitacoraCountMap, ticketCountMap };
};

const cargarEncargadosMap = async (ids) => {
  const valores = Array.isArray(ids)
    ? Array.from(
        new Set(
          ids
            .map((valor) => Number.parseInt(`${valor}`, 10))
            .filter((valor) => Number.isInteger(valor) && valor > 0)
        )
      )
    : [];

  if (!valores.length) {
    return new Map();
  }

  const cuentas = await CuentaModel.findAll({
    where: { id: { [Op.in]: valores } },
    attributes: ["id", "name", "email", "tipoCuentaId"],
    order: [["name", "ASC"]],
  });

  return new Map(
    cuentas.map((cuenta) => {
      const plain = cuenta.toJSON ? cuenta.toJSON() : cuenta;
      return [plain.id, plain];
    })
  );
};

const cargarProyectoDetalle = async (proyectoId) => {
  const proyecto = await ProyectoModel.findByPk(proyectoId, {
    include: proyectoIncludes,
  });

  if (!proyecto) {
    return null;
  }

  const encargadoIds = Array.isArray(proyecto.encargados)
    ? proyecto.encargados
    : parseIdArray(proyecto.encargados);
  const encargadosMap = await cargarEncargadosMap(encargadoIds);
  const { bitacoraCountMap, ticketCountMap } =
    await obtenerConteosBitacorasPorProyecto([proyecto.id]);

  const respuesta = buildProyectoResponse(proyecto, {
    encargadosMap,
    bitacoraCountMap,
    ticketCountMap,
  });

  const bitacoras = await BitacoraModel.findAll({
    where: { proyectoId: proyecto.id },
    include: bitacoraIncludes,
    order: [
      ["fechaVisita", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

  respuesta.bitacoras = bitacoras.map((row) =>
    row.toJSON ? row.toJSON() : row
  );
  respuesta.totalBitacoras = respuesta.bitacoras.length;
  respuesta.totalTickets = respuesta.bitacoras.filter(
    (bitacora) => !!bitacora.esTicket
  ).length;

  return respuesta;
};

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
        updates.haveTickets = parseBooleanFlag(
          haveTickets,
          cuenta.haveTickets
        );
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
  let tipoCuentaFiltro = { [Op.in]: [1, 2, 3, 4, 5] };
  if (option === "Mesa de ayuda") {
    tipoCuentaFiltro = 3;
  } else if (option === "TÃ©cnico de soporte") {
    tipoCuentaFiltro = 2;
  } else if (option === "Administrador") {
    tipoCuentaFiltro = 1;
  } else if (option === "Cliente") {
    tipoCuentaFiltro = 4;
  } else if (option === "Comercial") {
    tipoCuentaFiltro = 5;
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

    const perfilPlano = perfil?.toJSON ? perfil.toJSON() : perfil;
    if (perfilPlano) {
      const incluirDatosBancarios = perfilPlano.tipoCuentaId === 4;
      perfilPlano.clientesAutorizados = (perfilPlano.clientesAutorizados ?? []).map(
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
      if (
        telefonoParsed !== undefined &&
        Number.isFinite(telefonoParsed)
      ) {
        cuenta.telefono = telefonoParsed;
      } else if (telefono === "" || telefono === null) {
        cuenta.telefono = null;
      }
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

    const perfilPlano = perfilActualizado?.toJSON ? perfilActualizado.toJSON() : perfilActualizado;
    if (perfilPlano) {
      const incluirDatosBancarios = perfilPlano.tipoCuentaId === 4;
      perfilPlano.clientesAutorizados = (perfilPlano.clientesAutorizados ?? []).map(
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
      servicios,
      esLead: esLeadEntrada,
    } = req.body ?? {};
    const {
      presente: datosBancariosPresentes,
      datos: datosBancarios,
    } = obtenerDatosBancariosDesdeBody(req.body);
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

    const visitasEmergenciaParse =
      parseNonNegativeInt(visitasEmergenciaAnuales);
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

    await CasaMatrizModel.create({
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
      ...mapearDatosBancariosADB(datosBancariosPresentes ? datosBancarios : null),
    });

    return res.json({ resp: "Cliente creado correctamente" });
  } catch (error) {
    console.error("Error al crear cliente:", error);
    return res.status(500).json({
      resp: "Error al crear cliente",
      error: error.message,
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

    const {
      presente: datosBancariosPresentes,
      datos: datosBancarios,
    } = obtenerDatosBancariosDesdeBody(body);

    const esLead = parseBooleanFlag(esLeadEntrada, cliente.esLead);
    const campoFueEnviado = (campo) =>
      Object.prototype.hasOwnProperty.call(body, campo);

    const normalizarCampoTexto = (valor) => {
      if (valor === undefined) {
        return undefined;
      }
      const texto = normalizarTexto(`${valor ?? ""}`);
      return texto.length ? texto : null;
    };

    const normalizarRut = (valor) => {
      if (valor === undefined) {
        return undefined;
      }
      const texto = normalizarTexto(`${valor ?? ""}`);
      if (!texto.length) {
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

    return res.json({ resp: "Cliente modificado correctamente" });
  } catch (error) {
    console.error("Error al modificar cliente:", error);
    return res.status(500).json({
      resp: "Error al modificar cliente",
      error: error.message,
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
    departamentoId,
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
        throw new Error("Identificador de departamento inv\u00E1lido.");
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
      throw new Error("Debe seleccionar un departamento v\u00E1lido.");
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

    // Crear el cÃ³digo del equipo
    const deptCode = departamentoNombre.substring(0, 4).toUpperCase();
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

const postObservacion = async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const usuario = req.usuario;
  const puedeVerDatosBancarios =
    usuario && [1, 5].includes(usuario.tipoCuentaId);
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
      departamento: departamentoTexto,
      departamentoId,
      esArriendo,
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

    const asignarBooleano = (clave, valor, actual = false) => {
      if (valor === undefined) {
        return;
      }
      datosActualizados[clave] = parseBooleanFlag(valor, actual);
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

    asignarBooleano('esArriendo', esArriendo, Boolean(equipo.esArriendo));

    if (
      departamentoId !== undefined ||
      departamentoTexto !== undefined
    ) {
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
          return res.status(400).json({
            resp: "Identificador de departamento invalido.",
          });
        }

        const registroDepartamento =
          await DepartamentoEquipoModel.findByPk(parsedDepartamentoId);

        if (!registroDepartamento) {
          return res.status(400).json({
            resp: "El departamento seleccionado no existe.",
          });
        }

        departamentoNombre = registroDepartamento.name;
      } else if (departamentoTexto !== undefined) {
        const normalizado = normalizarTexto(departamentoTexto);

        if (!normalizado) {
          return res.status(400).json({
            resp: "El departamento no puede quedar vacio.",
          });
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
    const { mensuales, emergencias } = await obtenerConteoVisitasPorCliente(ids);

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

const getClientesBitacora = async (req, res) => {
  try {
    const usuario = req.usuario;
    const where = {};
    const esCliente = usuario && usuario.tipoCuentaId === 4;
    const restringidoABitacoras = esCliente && !usuario.haveTickets;

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
    whereEquipos.fechaIngreso = { [Op.between]: [fechaInicioFiltro, fechaFinFiltro] };
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
  const tipos = await TipoEquipoModel.findAll({
    order: [["name", "ASC"]],
  });

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

const normalizarCodigo = (valor) => {
  if (typeof valor !== "string") {
    return "";
  }
  return valor.trim().toUpperCase();
};

const normalizarTexto = (valor) => {
  if (typeof valor !== "string") {
    return "";
  }
  return valor.trim();
};

const COLORES_CRITERIO = new Set(["rojo", "amarillo", "verde"]);

const normalizarColorCriticidad = (valor, fallback = "amarillo") => {
  if (typeof valor !== "string") {
    return fallback;
  }

  const normalizado = valor.trim().toLowerCase();
  return COLORES_CRITERIO.has(normalizado) ? normalizado : fallback;
};

const parseValorComparable = (valor) => {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  if (typeof valor === "string") {
    const trimmed = valor.trim();

    if (!trimmed.length) {
      return null;
    }

    const numero = Number(trimmed);
    return Number.isNaN(numero) ? trimmed : numero;
  }

  if (typeof valor === "boolean") {
    return valor;
  }

  return null;
};

const parseJsonFlexible = (valor) => {
  if (valor === null || valor === undefined) {
    return undefined;
  }

  if (Array.isArray(valor)) {
    return valor;
  }

  if (typeof valor === "string") {
    const trimmed = valor.trim();
    if (!trimmed.length) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch (_error) {
      return [];
    }
  }

  return [];
};

const normalizarNombreTecnico = (valor) => {
  if (typeof valor !== "string") {
    return "";
  }
  return valor.trim().toLowerCase();
};

const obtenerCuentaIdsPorNombres = async (nombres) => {
  if (!Array.isArray(nombres) || nombres.length === 0) {
    return [];
  }

  const normalizados = Array.from(
    new Set(
      nombres
        .map((item) => `${item}`.trim())
        .filter((item) => item.length > 0)
    )
  );

  if (!normalizados.length) {
    return [];
  }

  const cuentas = await CuentaModel.findAll({
    where: {
      name: {
        [Op.in]: normalizados,
      },
    },
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

const construirNotificacionBitacora = (bitacora) => {
  const cliente =
    bitacora?.casaMatriz?.razonSocial ?? "Cliente sin nombre";
  let fecha = null;
  if (bitacora?.fechaVisita) {
    const date = new Date(bitacora.fechaVisita);
    if (!Number.isNaN(date.getTime())) {
      fecha = date.toISOString().slice(0, 10);
    }
  }
  const resumenBase =
    typeof bitacora?.titulo === "string" && bitacora.titulo.trim().length
      ? bitacora.titulo.trim()
      : typeof bitacora?.descripcion === "string"
      ? bitacora.descripcion.trim().slice(0, 120)
      : "";
  const resumen = resumenBase.length ? resumenBase : "Sin descripcion";

  const titulo = bitacora?.esTicket
    ? "Nuevo ticket asignado"
    : "Nueva bitacora asignada";

  return {
    titulo,
    mensaje: `${cliente} · ${resumen}`,
    metadata: {
      cliente,
      fecha,
      esTicket: !!bitacora?.esTicket,
      bitacoraId: bitacora?.id ?? null,
      titulo: bitacora?.titulo ?? null,
    },
  };
};

const crearNotificacionesAsignacionBitacora = async (
  bitacora,
  cuentaIds,
  asignadoPorId
) => {
  if (
    !bitacora ||
    !Array.isArray(cuentaIds) ||
    cuentaIds.length === 0
  ) {
    return;
  }

  const idsUnicos = Array.from(
    new Set(
      cuentaIds.filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  if (!idsUnicos.length) {
    return;
  }

  const datos = construirNotificacionBitacora(bitacora);
  const referenciaTipo = bitacora?.esTicket ? "ticket" : "bitacora";
  const ahora = new Date();

  await Promise.all(
    idsUnicos.map(async (cuentaId) => {
      const [registro, creado] = await NotificacionModel.findOrCreate({
        where: {
          cuentaId,
          referenciaId: bitacora.id,
          referenciaTipo,
        },
        defaults: {
          cuentaId,
          tipo: referenciaTipo,
          titulo: datos.titulo,
          mensaje: datos.mensaje,
          referenciaId: bitacora.id,
          referenciaTipo,
          metadata: {
            ...datos.metadata,
            asignadoPorId,
          },
          leida: false,
          createdAt: ahora,
          updatedAt: ahora,
        },
      });

      if (!creado) {
        await registro.update({
          titulo: datos.titulo,
          mensaje: datos.mensaje,
          metadata: {
            ...datos.metadata,
            asignadoPorId,
          },
          leida: false,
          updatedAt: ahora,
        });
      }
    })
  );
};

const parsePresetOptions = (rawValue) => {
  const lista = parseJsonFlexible(rawValue);

  if (!Array.isArray(lista)) {
    return [];
  }

  return lista
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const label = normalizarTexto(item.label);
      const value =
        item.value !== undefined && item.value !== null
          ? normalizarTexto(`${item.value}`)
          : "";

      if (!label || !value) {
        return null;
      }

      const color = normalizarColorCriticidad(item.color, "amarillo");

      return {
        label,
        value,
        color,
      };
    })
    .filter((item) => item !== null);
};

const parseStandards = (rawValue) => {
  const lista = parseJsonFlexible(rawValue);

  if (!Array.isArray(lista)) {
    return [];
  }

  return lista
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

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
      if (!etiqueta) {
        return null;
      }

      const regla = {
        color,
        label: etiqueta,
      };

      if (description) {
        regla.description = description;
      }

      if (operator) {
        regla.operator = operator;
      }

      if (value !== null) {
        regla.value = value;
      }

      if (secondaryValue !== null) {
        regla.secondaryValue = secondaryValue;
      }

      if (unit) {
        regla.unit = unit;
      }

      return regla;
    })
    .filter((item) => item !== null);
};

const formatearNombreCampo = (valor) => {
  const texto = normalizarTexto(valor);
  if (!texto) {
    return "";
  }

  return texto
    .toLowerCase()
    .replace(/[-_\s]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ""))
    .replace(/[^a-zA-Z0-9]/g, "");
};

const obtenerTipoEquipoPorId = async (id) => {
  if (!id) {
    return null;
  }

  const parsed = Number.parseInt(`${id}`, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return await TipoEquipoModel.findByPk(parsed);
};

const obtenerCampoIdsNormalizados = (campoIds) => {
  if (!Array.isArray(campoIds)) {
    return [];
  }

  const ids = campoIds
    .map((valor) => {
      const parsed = Number.parseInt(`${valor}`, 10);
      return Number.isNaN(parsed) ? null : parsed;
    })
    .filter((valor) => valor !== null && valor > 0);

  return Array.from(new Set(ids));
};

const crearTipoEquipo = async (req, res) => {
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
      where: {
        [Op.or]: [{ name: nombre }, { dict }],
      },
    });

    if (conflicto) {
      return res.status(409).json({
        error: "Ya existe un tipo de equipo con el mismo nombre o código.",
      });
    }

    const t = await db.transaction();

    try {
      const nuevoTipo = await TipoEquipoModel.create(
        {
          name: nombre,
          dict,
        },
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
      return res.status(201).json(nuevoTipo);
    } catch (error) {
      if (t && !t.finished) {
        await t.rollback();
      }
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

const actualizarTipoEquipo = async (req, res) => {
  const { id } = req.params;
  const tipo = await obtenerTipoEquipoPorId(id);

  if (!tipo) {
    return res.status(404).json({ error: "Tipo de equipo no encontrado." });
  }

  const nombre = normalizarTexto(req.body?.name);
  const dict = normalizarCodigo(req.body?.dict);
  const campoIds = obtenerCampoIdsNormalizados(req.body?.campoIds);

  if (!nombre && !dict && !campoIds.length) {
    return res.status(400).json({
      error:
        "Debe indicar al menos un campo a modificar (nombre, código o campos asociados).",
    });
  }

  try {
    const updates = {};

    if (nombre) {
      const conflictoNombre = await TipoEquipoModel.findOne({
        where: {
          name: nombre,
          id: {
            [Op.ne]: tipo.id,
          },
        },
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
        where: {
          dict,
          id: {
            [Op.ne]: tipo.id,
          },
        },
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
        // Si se envió el arreglo de campos, siempre sincronizamos
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
          await TipoEquipoCampoModel.bulkCreate(relaciones, {
            transaction: t,
          });
        }
      }

      await t.commit();
      return res.json(await TipoEquipoModel.findByPk(tipo.id));
    } catch (error) {
      if (t && !t.finished) {
        await t.rollback();
      }
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

const eliminarTipoEquipo = async (req, res) => {
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
      return res.status(400).json({
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

      return res.json({ mensaje: "Tipo de equipo eliminado correctamente." });
    } catch (error) {
      if (t && !t.finished) {
        await t.rollback();
      }
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

const obtenerCamposTipoEquipo = async (req, res) => {
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

const sincronizarCamposTipoEquipo = async (req, res) => {
  const { id } = req.params;
  const tipo = await obtenerTipoEquipoPorId(id);

  if (!tipo) {
    return res.status(404).json({ error: "Tipo de equipo no encontrado." });
  }

  const campoIds = obtenerCampoIdsNormalizados(req.body?.campoIds);

  try {
    const campos = await CampoModel.findAll({
      where: { id: campoIds },
    });

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

        await TipoEquipoCampoModel.bulkCreate(relaciones, {
          transaction: t,
        });
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
      if (t && !t.finished) {
        await t.rollback();
      }
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

const obtenerCampos = async (_req, res) => {
  try {
    const campos = await CampoModel.findAll({
      order: [["name", "ASC"]],
    });
    return res.json(campos);
  } catch (error) {
    console.error("Error al obtener los campos:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener la lista de campos." });
  }
};

const crearCampo = async (req, res) => {
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
      where: {
        [Op.or]: [{ name: nombreNormalizado }, { label }],
      },
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

    return res.status(201).json(campo);
  } catch (error) {
    console.error("Error al crear el campo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al crear el campo." });
  }
};

const actualizarCampo = async (req, res) => {
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
    return res.status(400).json({
      error:
        "Debe indicar al menos un atributo para actualizar (nombre, etiqueta, tipo, placeholder, requerido, opciones o estándares).",
    });
  }

  try {
    if (nombre) {
      const conflictoNombre = await CampoModel.findOne({
        where: {
          name: nombre,
          id: {
            [Op.ne]: campo.id,
          },
        },
      });

      if (conflictoNombre) {
        return res
          .status(409)
          .json({ error: "Ya existe otro campo con ese nombre." });
      }
    }

    if (label) {
      const conflictoLabel = await CampoModel.findOne({
        where: {
          label,
          id: {
            [Op.ne]: campo.id,
          },
        },
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
    if (placeholder !== undefined) {
      cambios.placeholder = placeholder || null;
    }
    if (required !== undefined) cambios.required = required;
    if (presetOptions !== undefined) {
      cambios.presetOptions = presetOptions;
    }
    if (standards !== undefined) {
      cambios.standards = standards;
    }

    await campo.update(cambios);
    return res.json(campo);
  } catch (error) {
    console.error("Error al actualizar el campo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el campo." });
  }
};

const eliminarCampo = async (req, res) => {
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
      return res.status(400).json({
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

const obtenerDepartamentosEquipo = async (_req, res) => {
  try {
    const departamentos = await DepartamentoEquipoModel.findAll({
      order: [["name", "ASC"]],
    });
    return res.json(departamentos);
  } catch (error) {
    console.error("Error al obtener los departamentos de equipo:", error);
    return res
      .status(500)
      .json({
        error: "Hubo un error al obtener los departamentos de equipo.",
      });
  }
};

const crearDepartamentoEquipo = async (req, res) => {
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
        error:
          "El nombre del departamento debe tener al menos 2 caracteres.",
      });
  }

  try {
    const existente = await DepartamentoEquipoModel.findOne({
      where: sqlWhere(fn("LOWER", col("name")), nombre.toLowerCase()),
    });

    if (existente) {
      return res.status(409).json({
        error:
          "Ya existe un departamento con el mismo nombre. Utiliza otro nombre.",
      });
    }

    const departamento = await DepartamentoEquipoModel.create({
      name: nombre,
    });

    return res.status(201).json(departamento);
  } catch (error) {
    console.error("Error al crear el departamento de equipo:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        error:
          "Ya existe un departamento con el mismo nombre. Utiliza otro nombre.",
      });
    }

    return res
      .status(500)
      .json({
        error: "Hubo un error al crear el departamento de equipo.",
      });
  }
};

const actualizarDepartamentoEquipo = async (req, res) => {
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
        error:
          "El nombre del departamento debe tener al menos 2 caracteres.",
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
      return res.status(409).json({
        error:
          "Ya existe otro departamento con el mismo nombre. Utiliza otro nombre.",
      });
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
    if (t && !t.finished) {
      await t.rollback();
    }

    console.error("Error al actualizar el departamento de equipo:", error);
    return res
      .status(500)
      .json({
        error: "Hubo un error al actualizar el departamento de equipo.",
      });
  }
};

const eliminarDepartamentoEquipo = async (req, res) => {
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
      return res.status(400).json({
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
      .json({
        error: "Hubo un error al eliminar el departamento de equipo.",
      });
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
      tipo,
      proyectoId,
      sinProyecto,
    } = req.query;

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limite, 10) || 10, 1);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    const esCliente = usuario && usuario.tipoCuentaId === 4;
    const restringidoABitacoras = esCliente && !usuario.haveTickets;

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

    const tipoFiltro = typeof tipo === "string" ? tipo.trim().toLowerCase() : "";
    if (tipoFiltro === "ticket" || tipoFiltro === "tickets") {
      where.esTicket = true;
    } else if (tipoFiltro === "bitacora" || tipoFiltro === "bit\u00e1cora") {
      where.esTicket = false;
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

    if (restringidoABitacoras) {
      if (where.esTicket === true) {
        return res.status(403).json({
          error: "Esta cuenta no tiene acceso al modulo de tickets.",
        });
      }
      where.esTicket = false;
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
      if (!usuario.haveTickets && bitacora.esTicket) {
        return res.status(403).json({
          error: "Esta cuenta no tiene acceso al modulo de tickets.",
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
      esTicket,
      estadoTicket: estadoTicketEntrada,
      ticketEstado,
      fechaTermino,
      detalleTermino,
      ticketFechaTermino,
      ticketDetalleTermino,
      proyectoId,
    } = bodyData;

    const tipoRegistroEntrada =
      typeof esTicket !== "undefined"
        ? esTicket
        : typeof bodyData?.tipo !== "undefined"
        ? bodyData.tipo
        : bodyData?.tipoRegistro;
    const esTicketFlag = parseTicketFlag(tipoRegistroEntrada, false);

    if (!casaMatrizId || !fechaVisita) {
      return res.status(400).json({
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

    const estadoEntrada =
      typeof estadoTicketEntrada !== "undefined"
        ? estadoTicketEntrada
        : typeof ticketEstado !== "undefined"
        ? ticketEstado
        : null;
    const estadoTicketNormalizado = esTicketFlag
      ? parseEstadoTicket(estadoEntrada, ESTADO_TICKET_INGRESADO)
      : null;

    const fechaTerminoEntrada =
      typeof fechaTermino !== "undefined" ? fechaTermino : ticketFechaTermino;
    const detalleTerminoEntrada =
      typeof detalleTermino !== "undefined"
        ? detalleTermino
        : ticketDetalleTermino;

    let fechaTerminoNormalizada = null;
    let detalleTerminoNormalizado = null;

    if (esTicketFlag && estadoTicketNormalizado === ESTADO_TICKET_TERMINADO) {
      const fechaNormalizada = toISODateOnly(fechaTerminoEntrada);
      if (!fechaNormalizada) {
        return res.status(400).json({
          error: "La fecha de termino del ticket es obligatoria.",
        });
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
        return res.status(400).json({
          error: "La hora de llegada debe tener un formato valido.",
        });
      }
      llegadaDate = new Date(horaLlegada);
    }

    let salidaDate = null;
    if (horaSalida) {
      if (!isValidDateValue(horaSalida)) {
        return res.status(400).json({
          error: "La hora de salida debe tener un formato valido.",
        });
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
    if (tecnicosArray.length === 0) {
      return res.status(400).json({
        error: "Debe indicar al menos un tecnico responsable de la visita.",
      });
    }

    const tecnicosIdsAsignados = await extraerIdsTecnicosAsignacion(
      bodyData,
      tecnicosArray
    );

    if (llegadaDate && salidaDate && salidaDate < llegadaDate) {
      return res.status(400).json({
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
      esTicket: esTicketFlag,
      estadoTicket: esTicketFlag
        ? estadoTicketNormalizado ?? ESTADO_TICKET_INGRESADO
        : null,
      fechaTermino: fechaTerminoNormalizada,
      detalleTermino: detalleTerminoNormalizado,
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

    const tecnicosPrevios = Array.isArray(bitacora.tecnicos)
      ? bitacora.tecnicos
          .map((item) => `${item}`.trim())
          .filter((item) => item.length > 0)
      : [];
    let idsAsignacionEntrada = null;

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
      esTicket,
    } = bodyData;

    let proyectoCambioSolicitado = false;
    let proyectoIdFinal = bitacora.proyectoId;
    let proyectoSeleccionado = null;

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
          return res.status(400).json({
            error: "El proyecto indicado no es valido.",
          });
        }
        proyectoSeleccionado = await ProyectoModel.findByPk(proyectoIdNumero);
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
        return res.status(400).json({
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
        if (tecnicosArray.length === 0) {
          return res.status(400).json({
            error: "Debe indicar al menos un tecnico responsable de la visita.",
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

      if (
        typeof esTicket !== "undefined" ||
        typeof bodyData?.tipo !== "undefined" ||
        typeof bodyData?.tipoRegistro !== "undefined"
      ) {
        const entradaTipo =
          typeof esTicket !== "undefined"
            ? esTicket
            : typeof bodyData?.tipo !== "undefined"
            ? bodyData.tipo
            : bodyData?.tipoRegistro;
        cambios.esTicket = parseTicketFlag(
          entradaTipo,
          bitacora.esTicket
        );
      }

      const tieneEstadoTicketEntrada =
        Object.prototype.hasOwnProperty.call(bodyData, "estadoTicket") ||
        Object.prototype.hasOwnProperty.call(bodyData, "ticketEstado");
      if (tieneEstadoTicketEntrada) {
        const entradaEstado = Object.prototype.hasOwnProperty.call(
          bodyData,
          "estadoTicket"
        )
          ? bodyData.estadoTicket
          : bodyData.ticketEstado;
        cambios.estadoTicket = parseEstadoTicket(
          entradaEstado,
          ESTADO_TICKET_INGRESADO
        );
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
            return res.status(400).json({
              error: "La fecha de termino del ticket no es valida.",
            });
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

    if (proyectoCambioSolicitado) {
      cambios.proyectoId = proyectoIdFinal;
    }

    const tieneCambio = (campo) =>
      Object.prototype.hasOwnProperty.call(cambios, campo);

    const esTicketFinal = tieneCambio("esTicket")
      ? cambios.esTicket
      : bitacora.esTicket;

    const horaLlegadaFinal = tieneCambio("horaLlegada")
      ? cambios.horaLlegada
      : bitacora.horaLlegada;
    const horaSalidaFinal = tieneCambio("horaSalida")
      ? cambios.horaSalida
      : bitacora.horaSalida;

    const llegadaDateFinal = horaLlegadaFinal ? new Date(horaLlegadaFinal) : null;
    const salidaDateFinal = horaSalidaFinal ? new Date(horaSalidaFinal) : null;

    if (!esTicketFinal) {
      if (!llegadaDateFinal || !salidaDateFinal) {
        return res.status(400).json({
          error:
            "Las horas de llegada y salida son obligatorias para bitacoras.",
        });
      }
      if (salidaDateFinal <= llegadaDateFinal) {
        return res.status(400).json({
          error: "La hora de salida debe ser posterior a la hora de llegada.",
        });
      }
    } else if (
      llegadaDateFinal &&
      salidaDateFinal &&
      salidaDateFinal < llegadaDateFinal
    ) {
      return res.status(400).json({
        error: "La hora de salida debe ser posterior a la hora de llegada.",
      });
    }

    if (!esTicketFinal) {
      cambios.estadoTicket = null;
      if (tieneCambio("fechaTermino")) {
        cambios.fechaTermino = null;
      }
      if (tieneCambio("detalleTermino")) {
        cambios.detalleTermino = null;
      }
    } else {
      let estadoTicketFinal = tieneCambio("estadoTicket")
        ? cambios.estadoTicket
        : parseEstadoTicket(bitacora.estadoTicket, ESTADO_TICKET_INGRESADO);
      if (!estadoTicketFinal) {
        estadoTicketFinal = ESTADO_TICKET_INGRESADO;
      }

      const fechaTerminoFinal = tieneCambio("fechaTermino")
        ? cambios.fechaTermino
        : bitacora.fechaTermino;
      const detalleTerminoFinal = tieneCambio("detalleTermino")
        ? cambios.detalleTermino
        : bitacora.detalleTermino;

      if (estadoTicketFinal === ESTADO_TICKET_TERMINADO) {
        if (!fechaTerminoFinal) {
          return res.status(400).json({
            error: "La fecha de termino del ticket es obligatoria.",
          });
        }
        if (!isValidDateValue(fechaTerminoFinal)) {
          return res.status(400).json({
            error: "La fecha de termino del ticket no es valida.",
          });
        }
        if (!limpiarDetalleTermino(detalleTerminoFinal)) {
          return res.status(400).json({
            error:
              "Debes indicar el detalle de lo realizado para cerrar el ticket.",
          });
        }
      } else {
        if (tieneCambio("fechaTermino")) {
          cambios.fechaTermino = null;
        }
        if (tieneCambio("detalleTermino")) {
          cambios.detalleTermino = null;
        }
        estadoTicketFinal = ESTADO_TICKET_INGRESADO;
      }

      cambios.estadoTicket = estadoTicketFinal;
    }

    if (Object.keys(cambios).length === 0) {
      const current = await BitacoraModel.findByPk(id, { include: bitacoraIncludes });
      return res.json(current);
    }

    cambios.actualizadoPorId = usuario.id;

    await bitacora.update(cambios);
    // Si llegaron archivos subidos, anexarlos a los arreglos correspondientes
    const nuevosAdjuntosIngreso = Array.isArray(req.uploadedFiles)
      ? req.uploadedFiles
      : [];
    const nuevosAdjuntosEvidencia = Array.isArray(req.uploadedEvidenceFiles)
      ? req.uploadedEvidenceFiles
      : [];

    if (nuevosAdjuntosIngreso.length || nuevosAdjuntosEvidencia.length) {
      try {
        if (nuevosAdjuntosIngreso.length) {
          const actualesIngreso = Array.isArray(bitacora.adjuntos)
            ? bitacora.adjuntos
            : [];
          bitacora.adjuntos = actualesIngreso.concat(nuevosAdjuntosIngreso);
        }
        if (nuevosAdjuntosEvidencia.length) {
          const actualesEvidencia = Array.isArray(bitacora.adjuntosTermino)
            ? bitacora.adjuntosTermino
            : [];
          bitacora.adjuntosTermino =
            actualesEvidencia.concat(nuevosAdjuntosEvidencia);
        }
        await bitacora.save();
      } catch (err) {
        console.error('Error al anexar adjuntos a bitacora:', err);
      }
    }
    await bitacora.reload({ include: bitacoraIncludes });

    let nuevosIdsNotificacion = [];
    if (Array.isArray(idsAsignacionEntrada) && idsAsignacionEntrada?.length) {
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
        nuevosIdsNotificacion = await obtenerCuentaIdsPorNombres(
          nuevosNombres
        );
      }
    }

    if (Array.isArray(nuevosIdsNotificacion) && nuevosIdsNotificacion.length) {
      await crearNotificacionesAsignacionBitacora(
        bitacora,
        nuevosIdsNotificacion,
        usuario.id
      );
    }

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

const getNotificaciones = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const soloNoLeidas =
      `${req.query?.soloNoLeidas ?? ""}`.trim().toLowerCase() === "true";
    const limiteRaw = Number.parseInt(`${req.query?.limite ?? 20}`, 10);
    const limite = Number.isInteger(limiteRaw)
      ? Math.min(Math.max(limiteRaw, 1), 100)
      : 20;

    const filtrosListado = {
      cuentaId: usuarioId,
    };
    if (soloNoLeidas) {
      filtrosListado.leida = false;
    }

    const [notificaciones, totalNoLeidas] = await Promise.all([
      NotificacionModel.findAll({
        where: filtrosListado,
        order: [["createdAt", "DESC"]],
        limit: limite,
      }),
      NotificacionModel.count({
        where: {
          cuentaId: usuarioId,
          leida: false,
        },
      }),
    ]);

    const data = notificaciones.map((item) => ({
      id: item.id,
      tipo: item.tipo,
      titulo: item.titulo,
      mensaje: item.mensaje,
      referenciaId: item.referenciaId,
      referenciaTipo: item.referenciaTipo,
      leida: item.leida,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return res.json({
      notificaciones: data,
      totalNoLeidas,
    });
  } catch (error) {
    console.error("Error al obtener notificaciones:", error);
    return res
      .status(500)
      .json({ error: "Ocurrio un error al obtener las notificaciones." });
  }
};

const marcarNotificacionesLeidas = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const idsEntrada = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [];
    const marcarTodas =
      `${req.body?.marcarTodas ?? ""}`.trim().toLowerCase() === "true";

    if (marcarTodas) {
      const [actualizadas] = await NotificacionModel.update(
        { leida: true },
        {
          where: {
            cuentaId: usuarioId,
            leida: false,
          },
        }
      );
      return res.json({ actualizadas });
    }

    const ids = Array.from(
      new Set(
        idsEntrada
          .map((valor) => Number.parseInt(`${valor}`, 10))
          .filter((valor) => Number.isInteger(valor) && valor > 0)
      )
    );

    if (!ids.length) {
      return res
        .status(400)
        .json({ error: "Debe indicar las notificaciones a marcar como leidas." });
    }

    const [actualizadas] = await NotificacionModel.update(
      { leida: true },
      {
        where: {
          cuentaId: usuarioId,
          id: { [Op.in]: ids },
        },
      }
    );

    return res.json({ actualizadas });
  } catch (error) {
    console.error("Error al actualizar notificaciones:", error);
    return res
      .status(500)
      .json({ error: "Ocurrio un error al actualizar las notificaciones." });
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








const getDocumentacionClientes = async (req, res) => {
  try {
    if (!cuentaPuedeGestionarDocumentos(req.usuario)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para ver la documentación." });
    }

    const { pagina = 1, limite = 10, clienteId, tipo, buscar } = req.query;

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 10, 1), 100);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    const clienteFiltro = typeof clienteId === "string" ? clienteId.trim() : "";
    if (clienteFiltro.length) {
      where.casaMatrizId = clienteFiltro;
    }

    const tipoNormalizado = normalizarTipoDocumento(tipo);
    if (tipoNormalizado) {
      where.tipo = tipoNormalizado;
    }

    const termino = typeof buscar === "string" ? buscar.trim() : "";
    if (termino.length) {
      where[Op.or] = [
        { nombreArchivo: { [Op.like]: `%${termino}%` } },
        { descripcion: { [Op.like]: `%${termino}%` } },
      ];
    }

    const { rows, count } = await ClienteDocumentoModel.findAndCountAll({
      where,
      include: documentoClienteIncludes,
      order: [["createdAt", "DESC"]],
      limit: limitNumber,
      offset,
    });

    const data = rows.map((row) => buildDocumentoClienteResponse(row));

    return res.json({
      data,
      total: count,
      pagina: pageNumber,
      paginasTotales: Math.ceil(count / limitNumber),
    });
  } catch (error) {
    console.error("Error al obtener la documentación de clientes:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener la documentación." });
  }
};

const crearDocumentoCliente = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!cuentaPuedeGestionarDocumentos(usuario)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para crear documentos." });
    }

    const clienteId =
      typeof req.body?.clienteId === "string"
        ? req.body.clienteId.trim()
        : "";

    if (!clienteId.length) {
      return res.status(400).json({ error: "Debe seleccionar un cliente." });
    }

    const cliente = await CasaMatrizModel.findByPk(clienteId, {
      attributes: ["id"],
    });
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    const tipoNormalizado = normalizarTipoDocumento(req.body?.tipo);
    if (!tipoNormalizado) {
      return res.status(400).json({
        error: "El tipo de documento seleccionado no es válido.",
      });
    }

    const descripcionLimpia =
      typeof req.body?.descripcion === "string"
        ? req.body.descripcion.trim()
        : "";

    const archivoSubido = req.documentoClienteArchivo;
    if (!archivoSubido) {
      return res.status(400).json({ error: "Debe adjuntar un archivo." });
    }

    const documento = await ClienteDocumentoModel.create({
      casaMatrizId: cliente.id,
      tipo: tipoNormalizado,
      descripcion: descripcionLimpia.length ? descripcionLimpia : null,
      archivo: archivoSubido.storageName,
      nombreArchivo: archivoSubido.originalName ?? null,
      mimeType: archivoSubido.mimeType ?? null,
      size:
        typeof archivoSubido.size === "number" && archivoSubido.size >= 0
          ? archivoSubido.size
          : null,
      subidoPorId: usuario?.id ?? null,
    });

    const documentoCompleto = await ClienteDocumentoModel.findByPk(
      documento.id,
      { include: documentoClienteIncludes }
    );

    return res
      .status(201)
      .json(buildDocumentoClienteResponse(documentoCompleto || documento));
  } catch (error) {
    console.error("Error al crear documento de cliente:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al guardar el documento." });
  }
};

const eliminarDocumentoCliente = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!cuentaPuedeGestionarDocumentos(usuario)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para eliminar documentos." });
    }

    const { id } = req.params;
    const documento = await ClienteDocumentoModel.findByPk(id);
    if (!documento) {
      return res.status(404).json({ error: "Documento no encontrado." });
    }

    const archivo = documento.archivo;
    await documento.destroy();

    if (archivo) {
      try {
        await bucket.file(archivo).delete();
      } catch (error) {
        console.warn(
          "No se pudo eliminar el archivo del almacenamiento:",
          error?.message || error
        );
      }
    }

    return res.json({ mensaje: "Documento eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar documento de cliente:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el documento." });
  }
};


const getProyectos = async (req, res) => {
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

const getProyecto = async (req, res) => {
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

const crearProyecto = async (req, res) => {
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
      const faltantes = encargadosIds.filter((idEncargado) => !existentesSet.has(idEncargado));
      if (faltantes.length) {
        return res.status(400).json({
          error: "Uno o mas encargados seleccionados no existen.",
        });
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
        return res.status(400).json({
          error: "La fecha de inicio del proyecto no es valida.",
        });
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
        return res.status(400).json({
          error: "La fecha de termino del proyecto no es valida.",
        });
      }
      fechaTerminoNormalizada = normalizada;
    }

    if (
      fechaInicioNormalizada &&
      fechaTerminoNormalizada &&
      fechaTerminoNormalizada < fechaInicioNormalizada
    ) {
      return res.status(400).json({
        error: "La fecha de termino no puede ser anterior a la fecha de inicio.",
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
    return res.status(201).json(detalle);
  } catch (error) {
    console.error("Error al crear proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al crear el proyecto." });
  }
};

const actualizarProyecto = async (req, res) => {
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
        return res.status(400).json({
          error: "El nombre del proyecto no puede quedar vacio.",
        });
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
        const faltantes = encargadosIds.filter((idEncargado) => !existentesSet.has(idEncargado));
        if (faltantes.length) {
          return res.status(400).json({
            error: "Uno o mas encargados seleccionados no existen.",
          });
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
          return res.status(400).json({
            error: "La fecha de inicio del proyecto no es valida.",
          });
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
          return res.status(400).json({
            error: "La fecha de termino del proyecto no es valida.",
          });
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
      return res.status(400).json({
        error: "La fecha de termino no puede ser anterior a la fecha de inicio.",
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
    return res.json(detalle);
  } catch (error) {
    console.error("Error al actualizar proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el proyecto." });
  }
};

const eliminarProyecto = async (req, res) => {
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

    return res.json({ mensaje: "Proyecto eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar proyecto:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el proyecto." });
  }
};

const agregarAdjuntosProyecto = async (req, res) => {
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

    if (!Array.isArray(req.projectArchivos) || req.projectArchivos.length === 0) {
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

const agregarBitacorasAProyecto = async (req, res) => {
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
      return res.status(400).json({
        error: "Debe indicar al menos una bitacora o ticket a asignar.",
      });
    }

    const registros = await BitacoraModel.findAll({
      where: { id: { [Op.in]: bitacoraIds } },
      attributes: ["id"],
      raw: true,
    });
    const existentes = new Set(registros.map((row) => row.id));
    const faltantes = bitacoraIds.filter((idBitacora) => !existentes.has(idBitacora));
    if (faltantes.length) {
      return res.status(404).json({
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

const removerBitacoraDeProyecto = async (req, res) => {
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
      return res.status(404).json({
        error: "La bitacora indicada no esta asociada al proyecto.",
      });
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

const eliminarProyectoAdjunto = async (req, res) => {
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
      return res.status(404).json({
        error: "El adjunto indicado no pertenece al proyecto.",
      });
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

const getVehiculos = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (usuario?.tipoCuentaId === 5) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para acceder al módulo de vehículos." });
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

const getVehiculo = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (usuario?.tipoCuentaId === 5) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para acceder al módulo de vehículos." });
    }

    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ error: "Debe indicar el vehículo que desea consultar." });
    }

    const vehiculo = await VehiculoModel.findByPk(id, {
      include: vehiculoIncludes,
    });
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado." });
    }

    return res.json(buildVehiculoResponse(vehiculo));
  } catch (error) {
    console.error("Error al obtener vehículo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener el vehículo." });
  }
};

const crearVehiculo = async (req, res) => {
  try {
    const { patente, responsable, fechaUltimaMantencion, fechaSiguienteMantencion } =
      req.body;

    const patenteLimpia = patente ? `${patente}`.trim().toUpperCase() : "";
    if (!patenteLimpia) {
      return res
        .status(400)
        .json({ error: "La patente del vehículo es obligatoria." });
    }

    const responsableLimpio = responsable ? `${responsable}`.trim() : "";
    if (!responsableLimpio) {
      return res
        .status(400)
        .json({ error: "Debe indicar el dueño o encargado del vehículo." });
    }

    const ultimaMantencionISO = fechaUltimaMantencion
      ? toISODateOnly(fechaUltimaMantencion)
      : null;
    if (fechaUltimaMantencion && !ultimaMantencionISO) {
      return res.status(400).json({
        error: "La fecha de última mantención indicada no es válida.",
      });
    }

    const siguienteMantencionISO = fechaSiguienteMantencion
      ? toISODateOnly(fechaSiguienteMantencion)
      : null;
    if (fechaSiguienteMantencion && !siguienteMantencionISO) {
      return res.status(400).json({
        error: "La fecha de siguiente mantención indicada no es válida.",
      });
    }

    const nuevoVehiculo = await VehiculoModel.create({
      patente: patenteLimpia,
      responsable: responsableLimpio,
      imagen: req.uploadedFile ?? null,
      fechaUltimaMantencion: ultimaMantencionISO,
      fechaSiguienteMantencion: siguienteMantencionISO,
    });

    return res.status(201).json(buildVehiculoResponse(nuevoVehiculo));
  } catch (error) {
    console.error("Error al crear vehículo:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        error: "Ya existe un vehículo registrado con la patente indicada.",
      });
    }

    return res
      .status(500)
      .json({ error: "Hubo un error al crear el vehículo." });
  }
};

const actualizarVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ error: "Debe indicar el vehículo que desea actualizar." });
    }

    const vehiculo = await VehiculoModel.findByPk(id);
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado." });
    }

    const {
      patente,
      responsable,
      fechaUltimaMantencion,
      fechaSiguienteMantencion,
      eliminarImagen,
    } = req.body;

    if (patente !== undefined) {
      const patenteLimpia = `${patente}`.trim().toUpperCase();
      if (!patenteLimpia) {
        return res
          .status(400)
          .json({ error: "La patente del vehículo no puede estar vacía." });
      }
      vehiculo.patente = patenteLimpia;
    }

    if (responsable !== undefined) {
      const responsableLimpio = `${responsable}`.trim();
      if (!responsableLimpio) {
        return res.status(400).json({
          error: "El dueño o encargado del vehículo no puede estar vacío.",
        });
      }
      vehiculo.responsable = responsableLimpio;
    }

    if (fechaUltimaMantencion !== undefined) {
      if (fechaUltimaMantencion === null || fechaUltimaMantencion === "") {
        vehiculo.fechaUltimaMantencion = null;
      } else {
        const ultimaMantencionISO = toISODateOnly(fechaUltimaMantencion);
        if (!ultimaMantencionISO) {
          return res.status(400).json({
            error: "La fecha de última mantención indicada no es válida.",
          });
        }
        vehiculo.fechaUltimaMantencion = ultimaMantencionISO;
      }
    }

    if (fechaSiguienteMantencion !== undefined) {
      if (fechaSiguienteMantencion === null || fechaSiguienteMantencion === "") {
        vehiculo.fechaSiguienteMantencion = null;
      } else {
        const siguienteMantencionISO = toISODateOnly(fechaSiguienteMantencion);
        if (!siguienteMantencionISO) {
          return res.status(400).json({
            error: "La fecha de siguiente mantención indicada no es válida.",
          });
        }
        vehiculo.fechaSiguienteMantencion = siguienteMantencionISO;
      }
    }

    if (parseBooleanFlag(eliminarImagen, false)) {
      vehiculo.imagen = null;
    }

    if (req.uploadedFile) {
      vehiculo.imagen = req.uploadedFile;
    }

    await vehiculo.save();

    const actualizado = await VehiculoModel.findByPk(vehiculo.id);
    return res.json(buildVehiculoResponse(actualizado));
  } catch (error) {
    console.error("Error al actualizar vehículo:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        error: "Ya existe un vehículo registrado con la patente indicada.",
      });
    }

    return res
      .status(500)
      .json({ error: "Hubo un error al actualizar el vehículo." });
  }
};

const eliminarVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ error: "Debe indicar el vehículo que desea eliminar." });
    }

    const vehiculo = await VehiculoModel.findByPk(id);
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado." });
    }

    await vehiculo.destroy();

    return res.json({ mensaje: "Vehículo eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar vehículo:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el vehículo." });
  }
};

const obtenerTecnicoIdsDesdeBody = (body) => {
  if (!body || typeof body !== "object") {
    return [];
  }

  if (body.tecnicoIds !== undefined) {
    return parseIdArray(body.tecnicoIds);
  }

  if (body.tecnicos !== undefined) {
    return parseIdArray(body.tecnicos);
  }

  if (body.encargados !== undefined) {
    return parseIdArray(body.encargados);
  }

  return [];
};

const crearVehiculoSalida = async (req, res) => {
  try {
    const { vehiculoId } = req.params;
    if (!vehiculoId) {
      return res
        .status(400)
        .json({ error: "Debe indicar el vehículo para registrar la salida." });
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
      return res.status(400).json({
        error: "Debe indicar una fecha y hora de salida válidas.",
      });
    }

    const odometroSalidaNumero = parseDecimalValue(odometroSalida);
    if (odometroSalidaNumero === null) {
      return res.status(400).json({
        error: "Debe indicar un odómetro de salida válido.",
      });
    }

    const llegadaDate = parseDateTimeValue(fechaHoraLlegada);
    const odometroLlegadaNumero =
      odometroLlegada !== undefined && odometroLlegada !== null && odometroLlegada !== ""
        ? parseDecimalValue(odometroLlegada)
        : null;

    if (
      odometroLlegada !== undefined &&
      odometroLlegada !== null &&
      odometroLlegada !== "" &&
      odometroLlegadaNumero === null
    ) {
      return res.status(400).json({
        error: "El odómetro de llegada indicado no es válido.",
      });
    }

    const combustibleFlag = parseBooleanFlag(cargaCombustible, false);
    const metodoPagoNormalizado = combustibleFlag
      ? normalizarMetodoPagoCombustible(metodoPago)
      : null;

    if (combustibleFlag && !metodoPagoNormalizado) {
      return res.status(400).json({
        error: "Debe indicar un método de pago válido para la carga de combustible.",
      });
    }

    const valorCargaNumero = combustibleFlag ? parseDecimalValue(valorCarga) : null;

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

    return res.status(201).json(buildVehiculoSalidaResponse(detalleSalida));
  } catch (error) {
    console.error("Error al crear salida de vehículo:", error);
    return res.status(500).json({
      error: "Hubo un error al registrar la salida del vehículo.",
    });
  }
};

const actualizarVehiculoSalida = async (req, res) => {
  try {
    const { vehiculoId, salidaId } = req.params;
    if (!vehiculoId || !salidaId) {
      return res.status(400).json({
        error: "Debe indicar el vehículo y la salida que desea actualizar.",
      });
    }

    const salida = await VehiculoSalidaModel.findOne({
      where: { id: salidaId, vehiculoId },
      include: vehiculoSalidaIncludes,
    });

    if (!salida) {
      return res.status(404).json({
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
        return res.status(400).json({
          error: "La fecha y hora de salida no pueden quedar vacías.",
        });
      }
      const salidaDate = parseDateTimeValue(fechaHoraSalida);
      if (!salidaDate) {
        return res.status(400).json({
          error: "Debe indicar una fecha y hora de salida válidas.",
        });
      }
      salida.fechaHoraSalida = salidaDate;
    }

    if (fechaHoraLlegada !== undefined) {
      if (!fechaHoraLlegada) {
        salida.fechaHoraLlegada = null;
      } else {
        const llegadaDate = parseDateTimeValue(fechaHoraLlegada);
        if (!llegadaDate) {
          return res.status(400).json({
            error: "La fecha y hora de llegada indicada no es válida.",
          });
        }
        salida.fechaHoraLlegada = llegadaDate;
      }
    }

    if (odometroSalida !== undefined) {
      const odometroSalidaNumero = parseDecimalValue(odometroSalida);
      if (odometroSalidaNumero === null) {
        return res.status(400).json({
          error: "Debe indicar un odómetro de salida válido.",
        });
      }
      salida.odometroSalida = odometroSalidaNumero;
    }

    if (odometroLlegada !== undefined) {
      if (odometroLlegada === null || odometroLlegada === "") {
        salida.odometroLlegada = null;
      } else {
        const odometroLlegadaNumero = parseDecimalValue(odometroLlegada);
        if (odometroLlegadaNumero === null) {
          return res.status(400).json({
            error: "El odómetro de llegada indicado no es válido.",
          });
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
        const metodoPagoNormalizado = normalizarMetodoPagoCombustible(metodoPago);
        if (!metodoPagoNormalizado) {
          return res.status(400).json({
            error: "Debe indicar un método de pago válido para la carga de combustible.",
          });
        }
        salida.metodoPago = metodoPagoNormalizado;
      }

      if (valorCarga !== undefined) {
        const valorCargaNumero = parseDecimalValue(valorCarga);
        if (valorCarga !== null && valorCarga !== "" && valorCargaNumero === null) {
          return res.status(400).json({
            error: "El valor de la carga indicado no es válido.",
          });
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
        where: {
          id: idsAdjuntosEliminar,
          vehiculoSalidaId: salida.id,
        },
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

    return res.json(buildVehiculoSalidaResponse(salida));
  } catch (error) {
    console.error("Error al actualizar salida de vehículo:", error);
    return res.status(500).json({
      error: "Hubo un error al actualizar la salida del vehículo.",
    });
  }
};

const eliminarVehiculoSalida = async (req, res) => {
  try {
    const { vehiculoId, salidaId } = req.params;
    if (!vehiculoId || !salidaId) {
      return res.status(400).json({
        error: "Debe indicar el vehículo y la salida que desea eliminar.",
      });
    }

    const salida = await VehiculoSalidaModel.findOne({
      where: { id: salidaId, vehiculoId },
    });

    if (!salida) {
      return res.status(404).json({
        error: "No se encontró la salida indicada para este vehículo.",
      });
    }

    await salida.destroy();

    return res.json({
      mensaje: "Salida eliminada correctamente.",
    });
  } catch (error) {
    console.error("Error al eliminar salida de vehículo:", error);
    return res.status(500).json({
      error: "Hubo un error al eliminar la salida del vehículo.",
    });
  }
};

const eliminarVehiculoSalidaAdjunto = async (req, res) => {
  try {
    const { vehiculoId, salidaId, adjuntoId } = req.params;
    if (!vehiculoId || !salidaId || !adjuntoId) {
      return res.status(400).json({
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

    if (!adjunto || adjunto.salida?.vehiculoId !== Number.parseInt(vehiculoId, 10)) {
      return res.status(404).json({
        error: "No se encontró el adjunto indicado para esta salida.",
      });
    }

    await adjunto.destroy();

    return res.json({ mensaje: "Adjunto eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar adjunto de salida de vehículo:", error);
    return res.status(500).json({
      error: "Hubo un error al eliminar el adjunto de la salida.",
    });
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
  crearTipoEquipo,
  actualizarTipoEquipo,
  eliminarTipoEquipo,
  obtenerCamposTipoEquipo,
  sincronizarCamposTipoEquipo,
  obtenerCampos,
  crearCampo,
  actualizarCampo,
  eliminarCampo,
  obtenerDepartamentosEquipo,
  crearDepartamentoEquipo,
  actualizarDepartamentoEquipo,
  eliminarDepartamentoEquipo,
  getSucursalById,
  getEquipmentsByCasaMatriz,
  getEquipmentById,
  generarUrl,
  getBitacoras,
  getBitacoraById,
  crearBitacora,
  actualizarBitacora,
  eliminarBitacora,
  getNotificaciones,
  marcarNotificacionesLeidas,
  getVisitasProgramadas,
  crearVisitaProgramada,
  eliminarVisitaProgramada,
  //? Estados de equipos
  getEstadosEquipo,
  actualizarEstadoEquipo,
  actualizarSoloEstadoEquipo,
  //? Estados de sucursales
  getEstadosSucursal,
  actualizarEstadoSucursal,
  getDocumentacionClientes,
  crearDocumentoCliente,
  eliminarDocumentoCliente,
  // Proyectos
  getProyectos,
  getProyecto,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  agregarAdjuntosProyecto,
  agregarBitacorasAProyecto,
  removerBitacoraDeProyecto,
  eliminarProyectoAdjunto,
  // Vehiculos
  getVehiculos,
  getVehiculo,
  crearVehiculo,
  actualizarVehiculo,
  eliminarVehiculo,
  crearVehiculoSalida,
  actualizarVehiculoSalida,
  eliminarVehiculoSalida,
  eliminarVehiculoSalidaAdjunto
};
