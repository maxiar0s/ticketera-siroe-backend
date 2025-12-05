/**
 * @fileoverview Funciones para construir respuestas de API.
 * Transforman modelos de Sequelize a objetos JSON para respuestas HTTP.
 */

import { parseStringArray, parseIdArray } from "./parsers.js";
import { sanitizarDatoBancario } from "./validators.js";

/** Columnas de datos bancarios en la base de datos */
export const DATOS_BANCARIOS_COLUMNAS_DB = [
  "banco",
  "tipoCuentaBancaria",
  "numeroCuentaBancaria",
  "titularCuenta",
  "rutTitularCuenta",
  "correoNotificacionPago",
];

/**
 * Crea un objeto de datos bancarios vacío.
 * @returns {object} Objeto con campos bancarios en null
 */
export const crearDatosBancariosVacios = () => ({
  banco: null,
  tipoCuenta: null,
  numeroCuenta: null,
  titular: null,
  rutTitular: null,
  correoNotificacion: null,
});

/**
 * Normaliza datos bancarios desde diferentes formatos de entrada.
 * @param {*} valor - Valor a normalizar (objeto, string JSON, etc.)
 * @returns {object|null} Datos bancarios normalizados o null
 */
export const normalizarDatosBancariosEntrada = (valor) => {
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

/**
 * Extrae datos bancarios del body de una petición.
 * @param {object} body - Body de la petición HTTP
 * @returns {{presente: boolean, datos: object|null}} Resultado de extracción
 */
export const obtenerDatosBancariosDesdeBody = (body) => {
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

/**
 * Mapea datos bancarios normalizados al formato de la base de datos.
 * @param {object} datos - Datos bancarios normalizados
 * @returns {object} Objeto con nombres de columnas de DB
 */
export const mapearDatosBancariosADB = (datos) => ({
  banco: datos?.banco ?? null,
  tipoCuentaBancaria: datos?.tipoCuenta ?? null,
  numeroCuentaBancaria: datos?.numeroCuenta ?? null,
  titularCuenta: datos?.titular ?? null,
  rutTitularCuenta: datos?.rutTitular ?? null,
  correoNotificacionPago: datos?.correoNotificacion ?? null,
});

/**
 * Construye datos bancarios desde un registro de la base de datos.
 * @param {object} registro - Registro de Sequelize
 * @returns {object|null} Datos bancarios formateados o null si vacío
 */
export const construirDatosBancariosDesdeRegistro = (registro) => {
  if (!registro) {
    return null;
  }

  const origen =
    registro?.datosBancarios && typeof registro.datosBancarios === "object"
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
    titular: sanitizarDatoBancario(origen.titular ?? registro.titularCuenta),
    rutTitular: sanitizarDatoBancario(
      origen.rutTitular ?? registro.rutTitularCuenta
    ),
    correoNotificacion: sanitizarDatoBancario(
      origen.correoNotificacion ?? registro.correoNotificacionPago
    ),
  };

  const tieneDatos = Object.values(datos).some(
    (valor) => valor && valor.length
  );
  return tieneDatos ? datos : null;
};

/**
 * Remueve columnas de datos bancarios de un objeto.
 * @param {object} objeto - Objeto a limpiar
 */
export const removerColumnasDatosBancarios = (objeto) => {
  DATOS_BANCARIOS_COLUMNAS_DB.forEach((columna) => {
    if (objeto && Object.prototype.hasOwnProperty.call(objeto, columna)) {
      delete objeto[columna];
    }
  });
};

/**
 * Transforma un cliente de Sequelize a formato de respuesta API.
 * @param {object} cliente - Modelo de cliente
 * @param {object} options - Opciones de transformación
 * @param {boolean} options.incluirDatosBancarios - Si incluir datos bancarios
 * @returns {object|null} Cliente formateado o null
 */
export const transformarClienteRespuesta = (
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

/**
 * Construye respuesta para una salida de vehículo.
 * @param {object} salida - Modelo de salida de vehículo
 * @returns {object|null} Salida formateada o null
 */
export const buildVehiculoSalidaResponse = (salida) => {
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

/**
 * Construye respuesta para un documento de cliente.
 * @param {object} documento - Modelo de documento
 * @returns {object} Documento formateado
 */
export const buildDocumentoClienteResponse = (documento) =>
  documento?.toJSON ? documento.toJSON() : documento;

/**
 * Construye respuesta para un vehículo con sus salidas.
 * @param {object} vehiculo - Modelo de vehículo
 * @param {object} opciones - Opciones adicionales
 * @returns {object|null} Vehículo formateado o null
 */
export const buildVehiculoResponse = (vehiculo, opciones = {}) => {
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

/**
 * Construye respuesta para un proyecto con sus relaciones.
 * @param {object} proyecto - Modelo de proyecto
 * @param {object} opciones - Opciones con maps de encargados y conteos
 * @returns {object|null} Proyecto formateado o null
 */
export const buildProyectoResponse = (proyecto, opciones = {}) => {
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
    plain.actualizadoPor = plain.actualizadoPor.toJSON();
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

/**
 * Construye objeto de notificación para una bitácora.
 * @param {object} bitacora - Modelo de bitácora
 * @returns {object} Datos de notificación
 */
export const construirNotificacionBitacora = (bitacora) => {
  const cliente = bitacora?.casaMatriz?.razonSocial ?? "Cliente";
  const sucursal = bitacora?.sucursal?.sucursal ?? "";
  const ubicacion = sucursal ? `${cliente} - ${sucursal}` : cliente;

  return {
    tipo: "asignacion_bitacora",
    titulo: "Nueva bitácora asignada",
    mensaje: `Se te ha asignado una bitácora en ${ubicacion}`,
    metadata: {
      bitacoraId: bitacora.id,
      casaMatrizId: bitacora.casaMatrizId,
      sucursalId: bitacora.sucursalId,
      fechaVisita: bitacora.fechaVisita,
    },
  };
};

/**
 * Construye objeto de notificación para un ticket.
 * @param {object} ticket - Modelo de ticket
 * @returns {object} Datos de notificación
 */
export const construirNotificacionTicket = (ticket) => {
  const cliente = ticket?.casaMatriz?.razonSocial ?? "Cliente";
  const sucursal = ticket?.sucursal?.sucursal ?? "";
  const ubicacion = sucursal ? `${cliente} - ${sucursal}` : cliente;

  return {
    tipo: "asignacion_ticket",
    titulo: "Nuevo ticket asignado",
    mensaje: `Se te ha asignado un ticket en ${ubicacion}`,
    metadata: {
      ticketId: ticket.id,
      casaMatrizId: ticket.casaMatrizId,
      sucursalId: ticket.sucursalId,
      fechaVisita: ticket.fechaVisita,
      prioridad: ticket.prioridad,
      tipoTicket: ticket.tipoTicket,
    },
  };
};
