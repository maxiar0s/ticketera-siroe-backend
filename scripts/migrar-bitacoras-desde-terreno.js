import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const dryRun = process.argv.includes("--dry-run");
const verbose = process.argv.includes("--verbose");

const sourceEnvPath = resolveEnvPath(
  process.env.SOURCE_ENV_FILE,
  [
    "../soporte-siroe-terreno/app-soporte-siroe/.env",
    "../../soporte-siroe-terreno/app-soporte-siroe/.env",
    ".env.terreno",
    ".env.source",
    ".env",
  ],
);
const targetEnvPath = resolveEnvPath(
  process.env.TARGET_ENV_FILE,
  [".env.local", ".env.ticket", ".env"],
);

const DEFAULT_ESTADO_SUCURSAL_MAP = {
  activa: "Operativa",
  activo: "Operativa",
  inactiva: "Con observaciones",
  inactivo: "Con observaciones",
  suspendida: "Suspendida temporalmente",
  suspendido: "Suspendida temporalmente",
};

function resolveEnvPath(explicitPath, candidates = []) {
  if (explicitPath) {
    return path.isAbsolute(explicitPath)
      ? explicitPath
      : path.resolve(rootDir, explicitPath);
  }

  for (const candidate of candidates) {
    const absolutePath = path.resolve(rootDir, candidate);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

function loadEnvFile(envPath) {
  if (!envPath || !fs.existsSync(envPath)) {
    return {};
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  return dotenv.parse(envContent);
}

function readConfigValue(envVars, baseKey, prefix) {
  return process.env[`${prefix}_${baseKey}`] || envVars[baseKey] || null;
}

function readTargetHostPort(envVars) {
  return process.env.TARGET_MYSQL_HOST_PORT || envVars.MYSQL_HOST_PORT || null;
}

function normalizeDbConfigForHostExecution(config, envVars, prefix) {
  if (prefix !== "TARGET") {
    return config;
  }

  const normalizedHost = normalizeText(config.host);
  if (normalizedHost !== "mysql" && normalizedHost !== "db") {
    return config;
  }

  const hostPortRaw = readTargetHostPort(envVars) || config.port;
  const hostPort = Number(hostPortRaw);
  if (!Number.isInteger(hostPort) || hostPort <= 0) {
    throw new Error(`Puerto host invalido para TARGET: ${hostPortRaw}`);
  }

  return {
    ...config,
    host: process.env.TARGET_DB_HOST || "127.0.0.1",
    port: hostPort,
    ssl: undefined,
  };
}

function buildDbConfig(envVars, prefix) {
  const host = readConfigValue(envVars, "DB_HOST", prefix);
  const portRaw = readConfigValue(envVars, "DB_PORT", prefix);
  const user = readConfigValue(envVars, "DB_USER", prefix);
  const password = readConfigValue(envVars, "DB_PASSWORD", prefix);
  const database =
    readConfigValue(envVars, "DB_DATABASE_NAME", prefix) ||
    process.env[`${prefix}_DB_NAME`] ||
    envVars.DB_NAME ||
    null;

  if (!host || !portRaw || !user || database === null) {
    throw new Error(
      `Configuracion incompleta para ${prefix}. Define ${prefix}_DB_HOST, ${prefix}_DB_PORT, ${prefix}_DB_USER, ${prefix}_DB_PASSWORD y ${prefix}_DB_DATABASE_NAME o usa un archivo env compatible.`,
    );
  }

  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Puerto invalido para ${prefix}: ${portRaw}`);
  }

  const config = {
    host,
    port,
    user,
    password,
    database,
    ssl: shouldUseSsl(host, port) ? { rejectUnauthorized: false } : undefined,
    multipleStatements: false,
    namedPlaceholders: true,
  };

  return normalizeDbConfigForHostExecution(config, envVars, prefix);
}

function shouldUseSsl(host, port) {
  return `${host}`.includes("ondigitalocean.com") || Number(port) === 25060;
}

function isSameDatabaseConfig(sourceConfig, targetConfig) {
  return (
    normalizeText(sourceConfig.host) === normalizeText(targetConfig.host) &&
    Number(sourceConfig.port) === Number(targetConfig.port) &&
    normalizeText(sourceConfig.user) === normalizeText(targetConfig.user) &&
    normalizeText(sourceConfig.database) === normalizeText(targetConfig.database)
  );
}

function normalizeText(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function normalizeRut(value) {
  return normalizeText(value).replace(/\./g, "").replace(/\s+/g, "");
}

function parseJsonObject(rawValue, fallbackValue) {
  if (!rawValue) {
    return fallbackValue;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (_error) {
    return fallbackValue;
  }

  return fallbackValue;
}

function normalizeArrayValue(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => `${item}`.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return normalizeArrayValue(parsed);
      }
    } catch (_error) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }

  return [];
}

function stringifyArrayValue(value) {
  return JSON.stringify(normalizeArrayValue(value));
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeInsertValue(value) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value);
  }

  return value;
}

function normalizeInsertValues(values) {
  return values.map((value) => normalizeInsertValue(value));
}

function isLocalHost(value) {
  const normalized = normalizeText(value);
  return normalized === "127.0.0.1" || normalized === "localhost";
}

function canSuggestTargetPort(config) {
  return isLocalHost(config.host);
}

function checkPortOpen(host, port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const finalize = (isOpen) => {
      if (resolved) {
        return;
      }
      resolved = true;
      socket.destroy();
      resolve(isOpen);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finalize(true));
    socket.once("timeout", () => finalize(false));
    socket.once("error", () => finalize(false));

    socket.connect(port, host);
  });
}

async function findSuggestedTargetPort(config) {
  const candidatePorts = [config.port, 3307, 3007, 3306]
    .map((value) => Number(value))
    .filter((value, index, array) => Number.isInteger(value) && value > 0 && array.indexOf(value) === index);

  for (const port of candidatePorts) {
    const isOpen = await checkPortOpen(config.host, port);
    if (isOpen) {
      return port;
    }
  }

  return null;
}

async function buildConnectionError(error, sourceConfig, targetConfig) {
  if (
    error?.code === "ECONNREFUSED" &&
    canSuggestTargetPort(targetConfig)
  ) {
    const suggestedPort = await findSuggestedTargetPort(targetConfig);
    if (suggestedPort && Number(suggestedPort) !== Number(targetConfig.port)) {
      return new Error(
        `connect ECONNREFUSED ${targetConfig.host}:${targetConfig.port}. Parece que Docker publico MySQL en otro puerto del host. Prueba con TARGET_MYSQL_HOST_PORT=${suggestedPort} o recrea con 'docker compose --env-file .env.local up -d --build --force-recreate'. Origen actual: ${sourceConfig.host}:${sourceConfig.port}/${sourceConfig.database}. Destino esperado: ${targetConfig.host}:${suggestedPort}/${targetConfig.database}.`,
      );
    }

    return new Error(
      `connect ECONNREFUSED ${targetConfig.host}:${targetConfig.port}. No hay ningun MySQL escuchando en ese puerto del host. Revisa 'docker compose ps' y confirma el puerto publicado por el servicio mysql. Si usas .env.local, levanta con 'docker compose --env-file .env.local up -d --build --force-recreate'.`,
    );
  }

  return error;
}

async function ensureMigrationMapTable(targetConnection) {
  await targetConnection.query(`
    CREATE TABLE IF NOT EXISTS MigracionBitacorasTerrenoMap (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      origenDatabase VARCHAR(255) NOT NULL,
      origenBitacoraId INT NOT NULL,
      destinoBitacoraId INT NOT NULL,
      origenCasaMatrizId VARCHAR(255) NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_origen_bitacora (origenDatabase, origenBitacoraId),
      UNIQUE KEY uq_destino_bitacora (destinoBitacoraId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function loadLookupMap(connection, tableName, keyField = "id") {
  const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
  const map = new Map();
  for (const row of rows) {
    map.set(row[keyField], row);
  }
  return map;
}

async function findExistingTableName(connection, candidates) {
  for (const candidate of candidates) {
    const [rows] = await connection.query("SHOW TABLES LIKE ?", [candidate]);
    if (Array.isArray(rows) && rows.length > 0) {
      return candidate;
    }
  }

  return null;
}

async function loadTargetCatalogByName(connection, tableName, nameField = "name") {
  const [rows] = await connection.query(
    `SELECT id, \`${nameField}\` AS name FROM \`${tableName}\` ORDER BY id ASC`,
  );
  const map = new Map();

  for (const row of rows) {
    const normalizedName = normalizeText(row.name);
    if (!normalizedName || map.has(normalizedName)) {
      continue;
    }
    map.set(normalizedName, row.id);
  }

  return map;
}

function resolveCatalogId(sourceId, sourceCatalogMap, targetCatalogMap) {
  if (!sourceId) {
    return null;
  }

  const sourceRow = sourceCatalogMap.get(sourceId);
  if (!sourceRow) {
    return null;
  }

  return targetCatalogMap.get(normalizeText(sourceRow.name)) || null;
}

function buildEstadoSucursalResolver(targetEstadoMap) {
  const envMap = parseJsonObject(process.env.SOURCE_TO_TARGET_SUCURSAL_STATUS_MAP, null);
  const aliasMap = envMap && Object.keys(envMap).length ? envMap : DEFAULT_ESTADO_SUCURSAL_MAP;

  return (sourceEstadoNombre) => {
    const normalizedSourceName = normalizeText(sourceEstadoNombre);
    if (!normalizedSourceName) {
      return null;
    }

    if (targetEstadoMap.has(normalizedSourceName)) {
      return targetEstadoMap.get(normalizedSourceName);
    }

    const targetName = aliasMap[normalizedSourceName];
    if (!targetName) {
      return null;
    }

    return targetEstadoMap.get(normalizeText(targetName)) || null;
  };
}

async function migrateCasasMatrices(sourceConnection, targetConnection, summary) {
  const [sourceRows] = await sourceConnection.query(
    "SELECT * FROM `CasasMatrices` ORDER BY id ASC",
  );
  const [targetRows] = await targetConnection.query(
    "SELECT * FROM `CasasMatrices` ORDER BY id ASC",
  );

  const byRut = new Map();
  const byName = new Map();
  const mapping = new Map();

  for (const row of targetRows) {
    const rutKey = normalizeRut(row.rut);
    const nameKey = normalizeText(row.razonSocial);
    if (rutKey && !byRut.has(rutKey)) {
      byRut.set(rutKey, row);
    }
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, row);
    }
  }

  for (const row of sourceRows) {
    const rutKey = normalizeRut(row.rut);
    const nameKey = normalizeText(row.razonSocial);
    let matched = (rutKey && byRut.get(rutKey)) || (nameKey && byName.get(nameKey)) || null;

    if (!matched && dryRun) {
      matched = { id: row.id };
      summary.casasMatrices.insertadas += 1;
    }

    if (!matched) {
      await targetConnection.query(
        `
          INSERT INTO CasasMatrices (
            id, imagen, logoPerfil, rut, razonSocial, encargadoGeneral, correo,
            telefonoEncargado, banco, tipoCuentaBancaria, numeroCuentaBancaria,
            titularCuenta, rutTitularCuenta, correoNotificacionPago,
            visitasMensuales, visitasEmergenciaAnuales, servicios, fechaIngreso, esLead
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        normalizeInsertValues([
          row.id,
          row.imagen ?? null,
          null,
          row.rut ?? null,
          row.razonSocial ?? null,
          row.encargadoGeneral ?? null,
          row.correo ?? null,
          row.telefonoEncargado ?? null,
          row.banco ?? null,
          row.tipoCuentaBancaria ?? null,
          row.numeroCuentaBancaria ?? null,
          row.titularCuenta ?? null,
          row.rutTitularCuenta ?? null,
          row.correoNotificacionPago ?? null,
          row.visitasMensuales ?? null,
          row.visitasEmergenciaAnuales ?? null,
          row.servicios ?? null,
          row.fechaIngreso ?? null,
          row.esLead ? 1 : 0,
        ]),
      );

      matched = { id: row.id };
      summary.casasMatrices.insertadas += 1;
    } else {
      summary.casasMatrices.reutilizadas += 1;
    }

    mapping.set(row.id, matched.id);
  }

  return mapping;
}

async function migrateCuentas(sourceConnection, targetConnection, summary) {
  const [sourceRows] = await sourceConnection.query(
    "SELECT * FROM `Cuentas` ORDER BY id ASC",
  );
  const [targetRows] = await targetConnection.query(
    "SELECT * FROM `Cuentas` ORDER BY id ASC",
  );
  const sourceTipoCuentaMap = await loadLookupMap(sourceConnection, "TipoCuenta");
  const sourceEstadoCuentaMap = await loadLookupMap(sourceConnection, "EstadoCuentas");
  const targetTipoCuentaMap = await loadTargetCatalogByName(targetConnection, "TipoCuenta");
  const targetEstadoCuentaMap = await loadTargetCatalogByName(targetConnection, "EstadoCuentas");

  const existingByEmail = new Map();
  const mapping = new Map();

  for (const row of targetRows) {
    const emailKey = normalizeText(row.email);
    if (emailKey && !existingByEmail.has(emailKey)) {
      existingByEmail.set(emailKey, row);
    }
  }

  for (const row of sourceRows) {
    const emailKey = normalizeText(row.email);
    if (!emailKey) {
      summary.cuentas.sinEmail.push(row.id);
      continue;
    }

    let matched = existingByEmail.get(emailKey) || null;
    if (!matched && dryRun) {
      matched = { id: row.id };
      summary.cuentas.insertadas += 1;
    }

    if (!matched) {
      const tipoCuentaId = resolveCatalogId(
        row.tipoCuentaId,
        sourceTipoCuentaMap,
        targetTipoCuentaMap,
      );
      const estadoCuentaId = resolveCatalogId(
        row.estadoCuentaId,
        sourceEstadoCuentaMap,
        targetEstadoCuentaMap,
      );

      const [result] = await targetConnection.query(
        `
          INSERT INTO Cuentas (
            name, telefono, email, password, token, esTecnico, haveTickets,
            tipoCuentaId, estadoCuentaId, modulosAcceso, ocupacion
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        normalizeInsertValues([
          row.name,
          row.telefono,
          row.email,
          row.password,
          row.token ?? null,
          row.esTecnico ? 1 : 0,
          row.haveTickets ? 1 : 0,
          tipoCuentaId,
          estadoCuentaId,
          null,
          null,
        ]),
      );

      matched = { id: result.insertId };
      existingByEmail.set(emailKey, matched);
      summary.cuentas.insertadas += 1;
    } else {
      summary.cuentas.reutilizadas += 1;
    }

    mapping.set(row.id, matched.id);
  }

  return mapping;
}

async function migrateCuentasCasasMatrices(
  sourceConnection,
  targetConnection,
  casaMatrizMap,
  cuentaMap,
  summary,
) {
  const [sourceRows] = await sourceConnection.query(
    "SELECT * FROM `CuentasCasasMatrices` ORDER BY cuentaId ASC, casaMatrizId ASC",
  );
  const [targetRows] = await targetConnection.query(
    "SELECT cuentaId, casaMatrizId FROM `CuentasCasasMatrices`",
  );

  const existing = new Set(
    targetRows.map((row) => `${row.cuentaId}::${row.casaMatrizId}`),
  );

  for (const row of sourceRows) {
    const mappedCuentaId = cuentaMap.get(row.cuentaId);
    const mappedCasaMatrizId = casaMatrizMap.get(row.casaMatrizId);

    if (!mappedCuentaId || !mappedCasaMatrizId) {
      summary.cuentasCasasMatrices.omitidas += 1;
      continue;
    }

    const key = `${mappedCuentaId}::${mappedCasaMatrizId}`;
    if (existing.has(key)) {
      summary.cuentasCasasMatrices.reutilizadas += 1;
      continue;
    }

    if (!dryRun) {
      await targetConnection.query(
        "INSERT INTO `CuentasCasasMatrices` (`cuentaId`, `casaMatrizId`) VALUES (?, ?)",
        [mappedCuentaId, mappedCasaMatrizId],
      );
    }

    existing.add(key);
    summary.cuentasCasasMatrices.insertadas += 1;
  }
}

async function migrateSucursales(
  sourceConnection,
  targetConnection,
  casaMatrizMap,
  summary,
) {
  const [sourceRows] = await sourceConnection.query(
    "SELECT * FROM `Sucursales` ORDER BY id ASC",
  );
  const [targetRows] = await targetConnection.query(
    "SELECT * FROM `Sucursales` ORDER BY id ASC",
  );
  const sourceEstadoTable = await findExistingTableName(sourceConnection, [
    "EstadoSucursales",
    "EstadoSucursals",
  ]);
  const targetEstadoTable = await findExistingTableName(targetConnection, [
    "EstadoSucursals",
    "EstadoSucursales",
  ]);

  if (!sourceEstadoTable) {
    throw new Error(
      "No se encontro tabla de estados de sucursales en origen. Se intento con EstadoSucursales y EstadoSucursals.",
    );
  }

  if (!targetEstadoTable) {
    throw new Error(
      "No se encontro tabla de estados de sucursales en destino. Se intento con EstadoSucursals y EstadoSucursales.",
    );
  }

  const sourceEstadoMap = await loadLookupMap(sourceConnection, sourceEstadoTable);
  const targetEstadoMap = await loadTargetCatalogByName(
    targetConnection,
    targetEstadoTable,
  );
  const resolveEstadoId = buildEstadoSucursalResolver(targetEstadoMap);

  const existing = new Map();
  const mapping = new Map();

  for (const row of targetRows) {
    const key = `${row.casaMatrizId}::${normalizeText(row.sucursal)}`;
    if (!existing.has(key)) {
      existing.set(key, row);
    }
  }

  for (const row of sourceRows) {
    const mappedCasaMatrizId = casaMatrizMap.get(row.casaMatrizId);
    if (!mappedCasaMatrizId) {
      summary.sucursales.sinCasaMatriz.push(row.id);
      continue;
    }

    const key = `${mappedCasaMatrizId}::${normalizeText(row.sucursal)}`;
    let matched = existing.get(key) || null;

    if (!matched && dryRun) {
      matched = { id: row.id };
      summary.sucursales.insertadas += 1;
    }

    if (!matched) {
      const sourceEstado = sourceEstadoMap.get(row.estado);
      const mappedEstadoId =
        resolveEstadoId(sourceEstado?.name) || Array.from(targetEstadoMap.values())[0] || null;

      if (!mappedEstadoId) {
        summary.sucursales.sinEstado.push(row.id);
        continue;
      }

      await targetConnection.query(
        `
          INSERT INTO Sucursales (
            id, estado, encargadoSucursal, correoSucursal, telefonoSucursal,
            sucursal, fechaIngreso, direccion, casaMatrizId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        normalizeInsertValues([
          row.id,
          mappedEstadoId,
          row.encargadoSucursal,
          row.correoSucursal,
          row.telefonoSucursal,
          row.sucursal,
          row.fechaIngreso ?? null,
          row.direccion,
          mappedCasaMatrizId,
        ]),
      );

      matched = { id: row.id };
      existing.set(key, matched);
      summary.sucursales.insertadas += 1;
    } else {
      summary.sucursales.reutilizadas += 1;
    }

    mapping.set(row.id, matched.id);
  }

  return mapping;
}

async function loadBitacoraMigrationMap(targetConnection, sourceDatabase) {
  const [rows] = await targetConnection.query(
    `
      SELECT origenBitacoraId, destinoBitacoraId
      FROM MigracionBitacorasTerrenoMap
      WHERE origenDatabase = ?
    `,
    [sourceDatabase],
  );

  return new Map(rows.map((row) => [row.origenBitacoraId, row.destinoBitacoraId]));
}

async function migrateBitacoras(
  sourceConnection,
  targetConnection,
  sourceDatabase,
  casaMatrizMap,
  cuentaMap,
  sucursalMap,
  summary,
) {
  const [sourceRows] = await sourceConnection.query(
    "SELECT * FROM `Bitacoras` ORDER BY id ASC",
  );
  const migrationMap = await loadBitacoraMigrationMap(targetConnection, sourceDatabase);
  const now = formatDate(new Date());

  for (const row of sourceRows) {
    if (migrationMap.has(row.id)) {
      summary.bitacoras.reutilizadas += 1;
      continue;
    }

    const mappedCasaMatrizId = casaMatrizMap.get(row.casaMatrizId);
    const mappedCreadoPorId = cuentaMap.get(row.creadoPorId);
    const mappedActualizadoPorId = cuentaMap.get(row.actualizadoPorId);
    const mappedSucursalId = row.sucursalId ? sucursalMap.get(row.sucursalId) || null : null;

    const missingReasons = [];
    if (!mappedCasaMatrizId) missingReasons.push("casaMatrizId");
    if (!mappedCreadoPorId) missingReasons.push("creadoPorId");
    if (!mappedActualizadoPorId) missingReasons.push("actualizadoPorId");
    if (row.sucursalId && !mappedSucursalId) missingReasons.push("sucursalId");

    if (missingReasons.length > 0) {
      summary.bitacoras.omitidas.push({
        id: row.id,
        missing: missingReasons,
      });
      continue;
    }

    let destinoBitacoraId = row.id;

    if (!dryRun) {
      const [result] = await targetConnection.query(
        `
          INSERT INTO Bitacoras (
            titulo, descripcion, tecnicos, fechaVisita, horaLlegada, horaSalida,
            casaMatrizId, sucursalId, creadoPorId, actualizadoPorId,
            adjuntos, adjuntosTermino, isEmergencia, proyectoId, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        normalizeInsertValues([
          row.titulo ?? null,
          row.descripcion,
          stringifyArrayValue(row.tecnicos),
          row.fechaVisita,
          row.horaLlegada ?? null,
          row.horaSalida ?? null,
          mappedCasaMatrizId,
          mappedSucursalId,
          mappedCreadoPorId,
          mappedActualizadoPorId,
          stringifyArrayValue(row.adjuntos),
          stringifyArrayValue(row.adjuntosTermino),
          row.isEmergencia ? 1 : 0,
          null,
          row.createdAt ?? now,
          row.updatedAt ?? row.createdAt ?? now,
        ]),
      );

      destinoBitacoraId = result.insertId;

      await targetConnection.query(
        `
          INSERT INTO MigracionBitacorasTerrenoMap (
            origenDatabase, origenBitacoraId, destinoBitacoraId, origenCasaMatrizId, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        normalizeInsertValues([
          sourceDatabase,
          row.id,
          destinoBitacoraId,
          row.casaMatrizId ?? null,
          now,
          now,
        ]),
      );
    }

    summary.bitacoras.insertadas += 1;

    if (verbose) {
      console.log(
        `Bitacora ${row.id} ${dryRun ? "preparada" : "migrada"} -> ${destinoBitacoraId}`,
      );
    }
  }
}

function printSummary(summary) {
  console.log("\nResumen de migracion:");
  console.log(
    `- CasasMatrices: insertadas=${summary.casasMatrices.insertadas}, reutilizadas=${summary.casasMatrices.reutilizadas}`,
  );
  console.log(
    `- Cuentas: insertadas=${summary.cuentas.insertadas}, reutilizadas=${summary.cuentas.reutilizadas}, sinEmail=${summary.cuentas.sinEmail.length}`,
  );
  console.log(
    `- CuentasCasasMatrices: insertadas=${summary.cuentasCasasMatrices.insertadas}, reutilizadas=${summary.cuentasCasasMatrices.reutilizadas}, omitidas=${summary.cuentasCasasMatrices.omitidas}`,
  );
  console.log(
    `- Sucursales: insertadas=${summary.sucursales.insertadas}, reutilizadas=${summary.sucursales.reutilizadas}, sinCasaMatriz=${summary.sucursales.sinCasaMatriz.length}, sinEstado=${summary.sucursales.sinEstado.length}`,
  );
  console.log(
    `- Bitacoras: insertadas=${summary.bitacoras.insertadas}, reutilizadas=${summary.bitacoras.reutilizadas}, omitidas=${summary.bitacoras.omitidas.length}`,
  );

  if (summary.bitacoras.omitidas.length > 0) {
    console.log("\nBitacoras omitidas por dependencias faltantes:");
    for (const item of summary.bitacoras.omitidas) {
      console.log(`  - ${item.id}: ${item.missing.join(", ")}`);
    }
  }

  if (summary.cuentas.sinEmail.length > 0) {
    console.log("\nCuentas omitidas por email vacio:");
    console.log(`  - ${summary.cuentas.sinEmail.join(", ")}`);
  }

  console.log(`\nModo: ${dryRun ? "dry-run (rollback)" : "ejecucion real"}`);
}

async function main() {
  const sourceEnv = loadEnvFile(sourceEnvPath);
  const targetEnv = loadEnvFile(targetEnvPath);
  const sourceConfig = buildDbConfig(sourceEnv, "SOURCE");
  const targetConfig = buildDbConfig(targetEnv, "TARGET");

  if (isSameDatabaseConfig(sourceConfig, targetConfig)) {
    throw new Error(
      "La conexion de origen y destino apunta a la misma base de datos. Define SOURCE_* y TARGET_* distintos antes de ejecutar la migracion.",
    );
  }

  let sourceConnection;
  let targetConnection;

  const summary = {
    casasMatrices: { insertadas: 0, reutilizadas: 0 },
    cuentas: { insertadas: 0, reutilizadas: 0, sinEmail: [] },
    cuentasCasasMatrices: { insertadas: 0, reutilizadas: 0, omitidas: 0 },
    sucursales: { insertadas: 0, reutilizadas: 0, sinCasaMatriz: [], sinEstado: [] },
    bitacoras: { insertadas: 0, reutilizadas: 0, omitidas: [] },
  };

  try {
    sourceConnection = await mysql.createConnection(sourceConfig);
    targetConnection = await mysql.createConnection(targetConfig);

    console.log(
      `Origen: ${sourceConfig.host}:${sourceConfig.port}/${sourceConfig.database}`,
    );
    console.log(
      `Destino: ${targetConfig.host}:${targetConfig.port}/${targetConfig.database}`,
    );

    await ensureMigrationMapTable(targetConnection);
    await targetConnection.beginTransaction();

    const casaMatrizMap = await migrateCasasMatrices(
      sourceConnection,
      targetConnection,
      summary,
    );
    const cuentaMap = await migrateCuentas(
      sourceConnection,
      targetConnection,
      summary,
    );

    await migrateCuentasCasasMatrices(
      sourceConnection,
      targetConnection,
      casaMatrizMap,
      cuentaMap,
      summary,
    );

    const sucursalMap = await migrateSucursales(
      sourceConnection,
      targetConnection,
      casaMatrizMap,
      summary,
    );

    await migrateBitacoras(
      sourceConnection,
      targetConnection,
      sourceConfig.database,
      casaMatrizMap,
      cuentaMap,
      sucursalMap,
      summary,
    );

    if (dryRun) {
      await targetConnection.rollback();
    } else {
      await targetConnection.commit();
    }

    printSummary(summary);
  } catch (error) {
    const enrichedError = await buildConnectionError(
      error,
      sourceConfig,
      targetConfig,
    );

    if (targetConnection) {
      try {
        await targetConnection.rollback();
      } catch (_rollbackError) {
        // ignore rollback error
      }
    }

    if (error?.sql) {
      console.error("SQL fallida:", error.sql);
    }
    if (error?.sqlMessage) {
      console.error("Detalle SQL:", error.sqlMessage);
    }
    console.error("Error al migrar bitacoras desde terreno:", enrichedError.message);
    if (verbose && enrichedError.stack) {
      console.error(enrichedError.stack);
    }
    process.exitCode = 1;
  } finally {
    if (sourceConnection) {
      await sourceConnection.end();
    }
    if (targetConnection) {
      await targetConnection.end();
    }
  }
}

main();
