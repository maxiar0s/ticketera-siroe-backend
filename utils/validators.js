/**
 * @fileoverview Funciones de validación y normalización de datos.
 * Incluye validadores para fechas, textos, RUTs y otros formatos.
 */

import { CLIENTE_DOCUMENTO_TIPOS } from "../models/ClienteDocumento.js";
import { metodosPago as vehiculoMetodosPago } from "../models/VehiculoSalida.js";

/** Set de tipos de documento válidos en minúsculas */
const DOCUMENTO_TIPOS_SET = new Set(
  CLIENTE_DOCUMENTO_TIPOS.map((tipo) => tipo.toLowerCase())
);

/** Colores válidos para criticidad */
const COLORES_CRITERIO = new Set(["rojo", "amarillo", "verde"]);

/**
 * Valida si un valor representa una fecha válida.
 * @param {*} value - Valor a validar
 * @returns {boolean} true si es una fecha válida
 */
export const isValidDateValue = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

/**
 * Convierte un valor a formato ISO de solo fecha (YYYY-MM-DD).
 * @param {*} value - Valor a convertir
 * @returns {string|null} Fecha en formato ISO o null si es inválida
 */
export const toISODateOnly = (value) => {
  if (!isValidDateValue(value)) {
    return null;
  }
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
};

/**
 * Normaliza un tipo de documento validando contra tipos permitidos.
 * @param {*} valor - Tipo de documento a normalizar
 * @returns {string|null} Tipo normalizado o null si es inválido
 */
export const normalizarTipoDocumento = (valor) => {
  if (typeof valor !== "string") {
    return null;
  }
  const normalized = valor.trim().toLowerCase();
  if (!normalized.length) {
    return null;
  }
  return DOCUMENTO_TIPOS_SET.has(normalized) ? normalized : null;
};

/**
 * Normaliza un código (limpia espacios y convierte a mayúsculas).
 * @param {*} valor - Código a normalizar
 * @returns {string|null} Código normalizado o null
 */
export const normalizarCodigo = (valor) => {
  if (typeof valor !== "string") {
    return null;
  }
  const trimmed = valor.trim().toUpperCase();
  return trimmed.length ? trimmed : null;
};

/**
 * Normaliza un texto simple (solo trim).
 * @param {*} valor - Texto a normalizar
 * @returns {string|null} Texto normalizado o null
 */
export const normalizarTexto = (valor) => {
  if (typeof valor !== "string") {
    return null;
  }
  const trimmed = valor.trim();
  return trimmed.length ? trimmed : null;
};

/**
 * Normaliza un nombre de técnico.
 * @param {*} valor - Nombre a normalizar
 * @returns {string|null} Nombre normalizado o null
 */
export const normalizarNombreTecnico = (valor) => {
  if (typeof valor !== "string") {
    return null;
  }
  const trimmed = valor.trim();
  return trimmed.length ? trimmed : null;
};

/**
 * Normaliza un color de criticidad validando contra colores permitidos.
 * @param {*} valor - Color a normalizar
 * @param {string} fallback - Valor por defecto si es inválido
 * @returns {string} Color normalizado o fallback
 */
export const normalizarColorCriticidad = (valor, fallback = "amarillo") => {
  if (typeof valor !== "string") {
    return fallback;
  }
  const normalized = valor.trim().toLowerCase();
  return COLORES_CRITERIO.has(normalized) ? normalized : fallback;
};

/**
 * Normaliza un método de pago de combustible.
 * @param {*} value - Método de pago a normalizar
 * @returns {string|null} Método normalizado o null si es inválido
 */
export const normalizarMetodoPagoCombustible = (value) => {
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

/**
 * Sanitiza un valor de dato bancario.
 * @param {*} valor - Valor a sanitizar
 * @returns {string|null} Valor sanitizado o null
 */
export const sanitizarDatoBancario = (valor) => {
  if (valor === null || valor === undefined) {
    return null;
  }
  const texto = typeof valor === "string" ? valor : `${valor}`;
  const trimmed = texto.trim();
  return trimmed.length ? trimmed : null;
};

/**
 * Limpia el detalle de término de un ticket.
 * @param {*} valor - Valor a limpiar
 * @returns {string} Texto limpio o cadena vacía
 */
export const limpiarDetalleTermino = (valor) => {
  if (typeof valor !== "string") {
    return "";
  }
  return valor.trim();
};

/**
 * Formatea el nombre de un campo (capitalización).
 * @param {*} valor - Nombre a formatear
 * @returns {string|null} Nombre formateado o null
 */
export const formatearNombreCampo = (valor) => {
  if (typeof valor !== "string") {
    return null;
  }
  const trimmed = valor.trim();
  if (!trimmed.length) {
    return null;
  }
  // Capitalizar primera letra de cada palabra
  return trimmed
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Verifica si una cuenta puede gestionar documentos.
 * @param {object} cuenta - Objeto cuenta
 * @returns {boolean} true si puede gestionar documentos
 */
export const cuentaPuedeGestionarDocumentos = (cuenta) =>
  !!cuenta && [1, 5].includes(cuenta.tipoCuentaId);

/**
 * Obtiene fechas de referencia para conteos de visitas.
 * @returns {object} Objeto con fechas de inicio de mes y año
 */
export const obtenerFechasReferenciaVisitas = () => {
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
