/**
 * @fileoverview Funciones puras de parseo de datos.
 * Transforman strings, arrays y valores JSON a formatos normalizados.
 */

/**
 * Parsea valores de clientes autorizados desde diferentes formatos de entrada.
 * @param {*} value - Valor a parsear (array, string JSON, string CSV, etc.)
 * @returns {string[]} Array de IDs de clientes autorizados como strings.
 */
export const parseClientesAutorizados = (value) => {
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

/**
 * Parsea un valor a un array de strings limpio.
 * Soporta arrays, strings JSON y strings CSV.
 * @param {*} value - Valor a parsear
 * @returns {string[]} Array de strings normalizados
 */
export const parseStringArray = (value) => {
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

/**
 * Parsea un valor a un array de IDs numéricos positivos.
 * @param {*} value - Valor a parsear
 * @returns {number[]} Array de IDs numéricos únicos
 */
export const parseIdArray = (value) => {
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

/**
 * Parsea un valor a boolean con soporte para múltiples formatos.
 * @param {*} value - Valor a parsear
 * @param {boolean} defaultValue - Valor por defecto si no se puede determinar
 * @returns {boolean} Valor boolean resultante
 */
export const parseBooleanFlag = (value, defaultValue = false) => {
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

    if (
      ["1", "true", "si", "sí", "yes", "arriendo", "rentado"].includes(
        normalized
      )
    ) {
      return true;
    }

    if (["0", "false", "no", "sin arriendo"].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
};

export const MODULE_ACCESS_KEYS = [
  'dashboard',
  'calendario',
  'dashboardCliente',
  'clientes',
  'sucursal',
  'bitacora',
  'tickets',
  'proyectos',
  'biblioteca',
  'vehiculos',
  'inventario',
  'opciones',
  'perfil',
  'adminUsuarios',
  'adminTiposEquipos',
  'reportes',
];

export const VALID_OCCUPATIONS = new Set([
  'Software',
  'Terreno',
  'Software/Terreno',
]);

export const normalizeOcupacionLabel = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = `${value}`.trim();

  if (normalized === 'Tecnico de Software') {
    return 'Software';
  }

  if (normalized === 'Tecnico en Terreno') {
    return 'Terreno';
  }

  return normalized;
};

export const buildDefaultModuleAccess = (enabled = true) => {
  return MODULE_ACCESS_KEYS.reduce((accumulator, moduleKey) => {
    accumulator[moduleKey] = enabled;
    return accumulator;
  }, {});
};

export const buildModuleAccessByOccupation = (occupation) => {
  const normalizedOccupation = normalizeOcupacionLabel(occupation);
  const normalized = buildDefaultModuleAccess(true);

  if (normalizedOccupation === 'Software') {
    normalized.clientes = false;
    normalized.sucursal = false;
    normalized.bitacora = false;
    normalized.vehiculos = false;
    normalized.inventario = false;
    normalized.adminTiposEquipos = false;
    return normalized;
  }

  if (normalizedOccupation === 'Terreno') {
    normalized.proyectos = false;
    normalized.biblioteca = false;
    return normalized;
  }

  return normalized;
};

export const parseOcupacion = (value, fallbackValue = null) => {
  if (value === undefined || value === null || value === '') {
    return normalizeOcupacionLabel(fallbackValue);
  }

  const normalized = normalizeOcupacionLabel(value);
  return VALID_OCCUPATIONS.has(normalized) ? normalized : null;
};

export const parseModuleAccess = (value, fallbackValue = null) => {
  const normalized = buildDefaultModuleAccess(true);
  const sources = [fallbackValue, value];

  sources.forEach((source) => {
    let sourceValue = source;

    if (typeof sourceValue === 'string') {
      try {
        sourceValue = JSON.parse(sourceValue);
      } catch (_error) {
        return;
      }
    }

    if (
      !sourceValue ||
      typeof sourceValue !== 'object' ||
      Array.isArray(sourceValue)
    ) {
      return;
    }

    MODULE_ACCESS_KEYS.forEach((moduleKey) => {
      normalized[moduleKey] = parseBooleanFlag(
        sourceValue[moduleKey],
        normalized[moduleKey]
      );
    });
  });

  return normalized;
};

/**
 * Parsea un query param a boolean, retornando null si está ausente.
 * @param {*} value - Valor del query param
 * @returns {boolean|null} Boolean o null si está ausente
 */
export const parseBooleanQueryParam = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const texto = `${value}`.trim();
  if (!texto.length) {
    return null;
  }

  return parseBooleanFlag(texto, false);
};

/**
 * Parsea un query param a número entero.
 * @param {*} value - Valor del query param
 * @returns {number|null} Número entero o null si es inválido
 */
export const parseNumericQueryParam = (value) => {
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

/**
 * Parsea un valor a entero no negativo.
 * @param {*} value - Valor a parsear
 * @param {number} defaultValue - Valor por defecto
 * @returns {{parsed: number, valid: boolean}} Objeto con el valor y su validez
 */
export const parseNonNegativeInt = (value, defaultValue = 0) => {
  if (value === undefined || value === null || value === "") {
    return { parsed: defaultValue, valid: true };
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return { parsed: defaultValue, valid: false };
  }

  return { parsed, valid: true };
};

/**
 * Parsea un valor a número decimal.
 * @param {*} value - Valor a parsear
 * @returns {number|null} Número decimal o null si es inválido
 */
export const parseDecimalValue = (value) => {
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

/**
 * Parsea un valor a objeto Date.
 * @param {*} value - Valor a parsear
 * @returns {Date|null} Objeto Date o null si es inválido
 */
export const parseDateTimeValue = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Parsea un valor de flag de ticket/bitácora.
 * @param {*} value - Valor a parsear
 * @param {boolean} defaultValue - Valor por defecto
 * @returns {boolean} true para ticket, false para bitácora
 */
export const parseTicketFlag = (value, defaultValue = false) => {
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

/** Estados válidos de ticket */
export const VALID_TICKET_STATES = new Set([
  "Nuevo",
  "Abierto",
  "Pendiente",
  "En espera",
  "Resuelto",
  "Cerrado",
]);

/** Estado inicial de ticket */
export const ESTADO_TICKET_INGRESADO = "Nuevo";

/** Estado final de ticket */
export const ESTADO_TICKET_TERMINADO = "Cerrado";

/**
 * Parsea y normaliza el estado de un ticket.
 * @param {*} value - Valor a parsear
 * @param {string|null} defaultValue - Valor por defecto
 * @returns {string|null} Estado normalizado o default
 */
export const parseEstadoTicket = (value, defaultValue = null) => {
  if (typeof value === "string") {
    // Mapeo de compatibilidad hacia atrás
    const normalized = value.trim();
    const lower = normalized.toLowerCase();

    if (lower === "ingresado") return "Nuevo";
    if (lower === "terminado") return "Cerrado";

    // Busqueda case-insensitive en los nuevos estados
    for (const state of VALID_TICKET_STATES) {
      if (state.toLowerCase() === lower) {
        return state;
      }
    }
  }
  return defaultValue;
};

/**
 * Parsea opciones preset de un campo.
 * @param {*} rawValue - Valor crudo
 * @returns {string[]|null} Array de opciones o null
 */
export const parsePresetOptions = (rawValue) => {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  if (Array.isArray(rawValue)) {
    return rawValue
      .map((v) => (typeof v === "string" ? v.trim() : String(v)))
      .filter((v) => v.length > 0);
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed.length) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return parsePresetOptions(parsed);
    } catch (_err) {
      return trimmed
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
  }

  return null;
};

/**
 * Parsea estándares de un tipo de equipo.
 * @param {*} rawValue - Valor crudo
 * @returns {object|null} Objeto de estándares normalizado o null
 */
export const parseStandards = (rawValue) => {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  let origen = rawValue;
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed.length) {
      return null;
    }
    try {
      origen = JSON.parse(trimmed);
    } catch (_err) {
      return null;
    }
  }

  if (!origen || typeof origen !== "object" || Array.isArray(origen)) {
    return null;
  }

  const resultado = {};
  let tieneValores = false;

  for (const [clave, valor] of Object.entries(origen)) {
    if (clave && typeof clave === "string") {
      const key = clave.trim();
      let valorFinal = null;

      if (typeof valor === "number" && Number.isFinite(valor)) {
        valorFinal = valor;
      } else if (typeof valor === "string") {
        const parsed = Number.parseFloat(valor.replace(",", "."));
        valorFinal = Number.isNaN(parsed) ? null : parsed;
      }

      if (valorFinal !== null && key.length) {
        resultado[key] = valorFinal;
        tieneValores = true;
      }
    }
  }

  return tieneValores ? resultado : null;
};

/**
 * Parsea JSON de forma flexible (string o objeto).
 * @param {*} valor - Valor a parsear
 * @returns {object|null} Objeto parseado o null
 */
export const parseJsonFlexible = (valor) => {
  if (valor === undefined || valor === null) {
    return null;
  }

  if (typeof valor === "object" && !Array.isArray(valor)) {
    return valor;
  }

  if (typeof valor === "string") {
    const trimmed = valor.trim();
    if (!trimmed.length) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_err) {
      // No es JSON válido
    }
  }

  return null;
};

/**
 * Parsea un valor a formato comparable.
 * @param {*} valor - Valor a parsear
 * @returns {string|number|null} Valor normalizado para comparación
 */
export const parseValorComparable = (valor) => {
  if (valor === undefined || valor === null) {
    return null;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  if (typeof valor === "boolean") {
    return valor ? 1 : 0;
  }

  if (typeof valor === "string") {
    const trimmed = valor.trim();
    if (!trimmed.length) {
      return null;
    }
    // Intentar como número
    const asNumber = Number.parseFloat(trimmed.replace(",", "."));
    if (!Number.isNaN(asNumber)) {
      return asNumber;
    }
    return trimmed.toLowerCase();
  }

  return null;
};
