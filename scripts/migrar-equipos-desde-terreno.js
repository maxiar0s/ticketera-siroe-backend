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

const DEFAULT_ESTADO_EQUIPO_MAP = {
  operativo: "Operativo",
  "requiere atencion": "Requiere atencion",
  "no operativo": "No funcional",
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

function normalizeComparableText(value) {
  return `${value ?? ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeDbConfigForHostExecution(config, envVars, prefix) {
  if (prefix !== "TARGET") {
    return config;
  }

  const normalizedHost = normalizeComparableText(config.host);
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
    ssl:
      `${host}`.includes("ondigitalocean.com") || Number(port) === 25060
        ? { rejectUnauthorized: false }
        : undefined,
    multipleStatements: false,
    namedPlaceholders: true,
  };

  return normalizeDbConfigForHostExecution(config, envVars, prefix);
}

function isSameDatabaseConfig(sourceConfig, targetConfig) {
  return (
    normalizeComparableText(sourceConfig.host) === normalizeComparableText(targetConfig.host) &&
    Number(sourceConfig.port) === Number(targetConfig.port) &&
    normalizeComparableText(sourceConfig.user) === normalizeComparableText(targetConfig.user) &&
    normalizeComparableText(sourceConfig.database) === normalizeComparableText(targetConfig.database)
  );
}

function normalizeText(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function normalizeRut(value) {
  return normalizeComparableText(value).replace(/\./g, "").replace(/\s+/g, "");
}

function normalizeInsertValue(value) {
  if (value === undefined || value === null) {
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
      if (resolved) return;
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
  if (error?.code === "ECONNREFUSED" && canSuggestTargetPort(targetConfig)) {
    const suggestedPort = await findSuggestedTargetPort(targetConfig);
    if (suggestedPort && Number(suggestedPort) !== Number(targetConfig.port)) {
      return new Error(
        `connect ECONNREFUSED ${targetConfig.host}:${targetConfig.port}. Parece que Docker publico MySQL en otro puerto del host. Prueba con TARGET_MYSQL_HOST_PORT=${suggestedPort} o recrea con 'docker compose --env-file .env.local up -d --build --force-recreate'. Origen actual: ${sourceConfig.host}:${sourceConfig.port}/${sourceConfig.database}. Destino esperado: ${targetConfig.host}:${suggestedPort}/${targetConfig.database}.`,
      );
    }

    return new Error(
      `connect ECONNREFUSED ${targetConfig.host}:${targetConfig.port}. No hay ningun MySQL escuchando en ese puerto del host. Revisa 'docker compose ps' y confirma el puerto publicado por el servicio mysql.`,
    );
  }

  return error;
}

async function findExistingTableName(connection, candidates) {
  for (const candidate of candidates) {
    const [rows] = await connection.query("SHOW TABLES LIKE ?", [candidate]);
    if (rows.length > 0) {
      return candidate;
    }
  }
  return null;
}

async function loadLookupMap(connection, tableName, keyField = "id") {
  const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
  return new Map(rows.map((row) => [row[keyField], row]));
}

async function loadCatalogRows(connection, tableName, options = {}) {
  const { nameField = "name", includeDict = false } = options;
  const selectDict = includeDict ? ", dict" : "";
  const [rows] = await connection.query(
    `SELECT id, \`${nameField}\` AS name${selectDict} FROM \`${tableName}\` ORDER BY id ASC`,
  );
  return rows;
}

function buildCatalogMaps(rows) {
  const byName = new Map();
  const byDict = new Map();

  for (const row of rows) {
    const normalizedName = normalizeComparableText(row.name);
    const normalizedDict = normalizeComparableText(row.dict);

    if (normalizedName && !byName.has(normalizedName)) {
      byName.set(normalizedName, row.id);
    }

    if (normalizedDict && !byDict.has(normalizedDict)) {
      byDict.set(normalizedDict, row.id);
    }
  }

  return { byName, byDict };
}

async function ensureMigrationMapTable(targetConnection) {
  await targetConnection.query(`
    CREATE TABLE IF NOT EXISTS MigracionEquiposTerrenoMap (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      origenDatabase VARCHAR(255) NOT NULL,
      origenEquipoId INT NOT NULL,
      destinoEquipoId INT NOT NULL,
      origenSucursalId VARCHAR(255) NULL,
      origenCodigoId VARCHAR(255) NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_origen_equipo (origenDatabase, origenEquipoId),
      UNIQUE KEY uq_destino_equipo (destinoEquipoId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function migrateCasasMatrices(sourceConnection, targetConnection, summary) {
  const [sourceRows] = await sourceConnection.query("SELECT * FROM `CasasMatrices` ORDER BY id ASC");
  const [targetRows] = await targetConnection.query("SELECT * FROM `CasasMatrices` ORDER BY id ASC");

  const byRut = new Map();
  const byName = new Map();
  const mapping = new Map();

  for (const row of targetRows) {
    const rutKey = normalizeRut(row.rut);
    const nameKey = normalizeComparableText(row.razonSocial);
    if (rutKey && !byRut.has(rutKey)) byRut.set(rutKey, row);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, row);
  }

  for (const row of sourceRows) {
    const rutKey = normalizeRut(row.rut);
    const nameKey = normalizeComparableText(row.razonSocial);
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

function buildEstadoSucursalResolver(targetMaps) {
  return (sourceName) => {
    const normalizedSource = normalizeComparableText(sourceName);
    if (!normalizedSource) {
      return null;
    }

    return (
      targetMaps.byName.get(normalizedSource) ||
      targetMaps.byName.get(normalizeComparableText(DEFAULT_ESTADO_SUCURSAL_MAP[normalizedSource])) ||
      null
    );
  };
}

async function migrateSucursales(sourceConnection, targetConnection, casaMatrizMap, summary) {
  const [sourceRows] = await sourceConnection.query("SELECT * FROM `Sucursales` ORDER BY id ASC");
  const [targetRows] = await targetConnection.query("SELECT * FROM `Sucursales` ORDER BY id ASC");

  const sourceEstadoTable = await findExistingTableName(sourceConnection, [
    "EstadoSucursales",
    "EstadoSucursals",
  ]);
  const targetEstadoTable = await findExistingTableName(targetConnection, [
    "EstadoSucursals",
    "EstadoSucursales",
  ]);

  if (!sourceEstadoTable || !targetEstadoTable) {
    throw new Error("No se encontro tabla de estados de sucursales en origen o destino.");
  }

  const sourceEstadoMap = await loadLookupMap(sourceConnection, sourceEstadoTable);
  const targetEstadoMaps = buildCatalogMaps(await loadCatalogRows(targetConnection, targetEstadoTable));
  const resolveEstadoId = buildEstadoSucursalResolver(targetEstadoMaps);

  const existing = new Map();
  const mapping = new Map();

  for (const row of targetRows) {
    const key = `${row.casaMatrizId}::${normalizeComparableText(row.sucursal)}`;
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

    const key = `${mappedCasaMatrizId}::${normalizeComparableText(row.sucursal)}`;
    let matched = existing.get(key) || null;

    if (!matched && dryRun) {
      matched = { id: row.id };
      summary.sucursales.insertadas += 1;
    }

    if (!matched) {
      const sourceEstado = sourceEstadoMap.get(row.estado);
      const mappedEstadoId =
        resolveEstadoId(sourceEstado?.name) || Array.from(targetEstadoMaps.byName.values())[0] || null;

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

async function migrateTipoEquipos(sourceConnection, targetConnection, summary) {
  const sourceRows = await loadCatalogRows(sourceConnection, "TipoEquipos", { includeDict: true });
  const targetRows = await loadCatalogRows(targetConnection, "TipoEquipos", { includeDict: true });
  const targetMaps = buildCatalogMaps(targetRows);
  const mapping = new Map();

  for (const row of sourceRows) {
    const normalizedName = normalizeComparableText(row.name);
    const normalizedDict = normalizeComparableText(row.dict);
    let matchedId =
      (normalizedDict && targetMaps.byDict.get(normalizedDict)) ||
      (normalizedName && targetMaps.byName.get(normalizedName)) ||
      null;

    if (!matchedId && dryRun) {
      matchedId = row.id;
      summary.tipoEquipos.insertados += 1;
    }

    if (!matchedId) {
      const [result] = await targetConnection.query(
        "INSERT INTO `TipoEquipos` (`name`, `dict`) VALUES (?, ?)",
        normalizeInsertValues([row.name, row.dict]),
      );
      matchedId = result.insertId;
      if (normalizedName) targetMaps.byName.set(normalizedName, matchedId);
      if (normalizedDict) targetMaps.byDict.set(normalizedDict, matchedId);
      summary.tipoEquipos.insertados += 1;
    } else {
      summary.tipoEquipos.reutilizados += 1;
    }

    mapping.set(row.id, matchedId);
  }

  return mapping;
}

function buildEstadoEquipoResolver(targetMaps) {
  return (sourceName) => {
    const normalizedSource = normalizeComparableText(sourceName);
    if (!normalizedSource) {
      return null;
    }

    return (
      targetMaps.byName.get(normalizedSource) ||
      targetMaps.byName.get(normalizeComparableText(DEFAULT_ESTADO_EQUIPO_MAP[normalizedSource])) ||
      null
    );
  };
}

async function migrateEstadoEquipos(sourceConnection, targetConnection) {
  const sourceRows = await loadCatalogRows(sourceConnection, "EstadoEquipos");
  const targetRows = await loadCatalogRows(targetConnection, "EstadoEquipos");
  const sourceMap = new Map(sourceRows.map((row) => [row.id, row.name]));
  const targetMaps = buildCatalogMaps(targetRows);
  const resolver = buildEstadoEquipoResolver(targetMaps);

  return {
    sourceMap,
    resolveTargetId(sourceId) {
      return resolver(sourceMap.get(sourceId)) || null;
    },
  };
}

async function loadEquipoMigrationMap(targetConnection, sourceDatabase) {
  const [rows] = await targetConnection.query(
    `
      SELECT origenEquipoId, destinoEquipoId
      FROM MigracionEquiposTerrenoMap
      WHERE origenDatabase = ?
    `,
    [sourceDatabase],
  );

  return new Map(rows.map((row) => [row.origenEquipoId, row.destinoEquipoId]));
}

function buildExistingTargetEquipos(rows) {
  const bySucursalAndCodigo = new Map();

  for (const row of rows) {
    const key = `${row.sucursalId ?? ""}::${normalizeComparableText(row.codigoId)}`;
    if (row.sucursalId && row.codigoId && !bySucursalAndCodigo.has(key)) {
      bySucursalAndCodigo.set(key, row.id);
    }
  }

  return { bySucursalAndCodigo };
}

async function migrateEquipos(
  sourceConnection,
  targetConnection,
  sourceDatabase,
  casaMatrizMap,
  sucursalMap,
  tipoEquipoMap,
  estadoEquipoContext,
  summary,
) {
  const [sourceRows] = await sourceConnection.query("SELECT * FROM `Equipos` ORDER BY id ASC");
  const [targetRows] = await targetConnection.query(
    "SELECT id, codigoId, sucursalId FROM `Equipos` ORDER BY id ASC",
  );
  const sourceSucursales = await loadLookupMap(sourceConnection, "Sucursales");
  const migrationMap = await loadEquipoMigrationMap(targetConnection, sourceDatabase);
  const existing = buildExistingTargetEquipos(targetRows);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  for (const row of sourceRows) {
    if (migrationMap.has(row.id)) {
      summary.equipos.reutilizados += 1;
      continue;
    }

    const sourceSucursal = sourceSucursales.get(row.sucursalId);
    const mappedSucursalId = row.sucursalId ? sucursalMap.get(row.sucursalId) || null : null;
    const mappedCasaMatrizId = row.casaMatrizId
      ? casaMatrizMap.get(row.casaMatrizId) || null
      : sourceSucursal?.casaMatrizId
        ? casaMatrizMap.get(sourceSucursal.casaMatrizId) || null
        : null;
    const mappedTipoEquipoId = row.tipoEquipoId ? tipoEquipoMap.get(row.tipoEquipoId) || null : null;
    const mappedEstadoId = estadoEquipoContext.resolveTargetId(row.estado);

    const missing = [];
    if (!mappedSucursalId) missing.push("sucursalId");
    if (!mappedCasaMatrizId) missing.push("casaMatrizId");
    if (!mappedTipoEquipoId) missing.push("tipoEquipoId");
    if (!mappedEstadoId) missing.push("estado");

    if (missing.length > 0) {
      summary.equipos.omitidos.push({ id: row.id, missing });
      continue;
    }

    const duplicateKey = `${mappedSucursalId}::${normalizeComparableText(row.codigoId)}`;
    let destinoEquipoId = existing.bySucursalAndCodigo.get(duplicateKey) || null;

    if (destinoEquipoId) {
      summary.equipos.reutilizados += 1;
      if (!dryRun) {
        await targetConnection.query(
          `
            INSERT INTO MigracionEquiposTerrenoMap (
              origenDatabase, origenEquipoId, destinoEquipoId, origenSucursalId, origenCodigoId, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          normalizeInsertValues([
            sourceDatabase,
            row.id,
            destinoEquipoId,
            row.sucursalId ?? null,
            row.codigoId ?? null,
            now,
            now,
          ]),
        );
      }
      continue;
    }

    if (!dryRun) {
      const [result] = await targetConnection.query(
        `
          INSERT INTO Equipos (
            numeroSecuencial, codigoId, estado, fechaIngreso, departamento, usuario,
            imagen, placaMadre, fuenteDePoder, marca, modelo, numeroSerie,
            procesador, velocidadProcesador, ram, tipoAlmacenamiento,
            cantidadAlmacenamiento, sistemaOperativo, ofimatica, antivirus,
            esArriendo, casaMatrizId, sucursalId, tipoEquipoId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        normalizeInsertValues([
          row.numeroSecuencial,
          row.codigoId,
          mappedEstadoId,
          row.fechaIngreso ?? null,
          row.departamento,
          row.usuario ?? null,
          row.imagen ?? null,
          row.placaMadre ?? null,
          row.fuenteDePoder ?? null,
          row.marca ?? null,
          row.modelo ?? null,
          row.numeroSerie ?? null,
          row.procesador ?? null,
          row.velocidadProcesador ?? null,
          row.ram ?? null,
          row.tipoAlmacenamiento ?? null,
          row.cantidadAlmacenamiento ?? null,
          row.sistemaOperativo ?? null,
          row.ofimatica ?? null,
          row.antivirus ?? null,
          row.esArriendo ? 1 : 0,
          mappedCasaMatrizId,
          mappedSucursalId,
          mappedTipoEquipoId,
        ]),
      );

      destinoEquipoId = result.insertId;
      existing.bySucursalAndCodigo.set(duplicateKey, destinoEquipoId);

      await targetConnection.query(
        `
          INSERT INTO MigracionEquiposTerrenoMap (
            origenDatabase, origenEquipoId, destinoEquipoId, origenSucursalId, origenCodigoId, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        normalizeInsertValues([
          sourceDatabase,
          row.id,
          destinoEquipoId,
          row.sucursalId ?? null,
          row.codigoId ?? null,
          now,
          now,
        ]),
      );
    }

    summary.equipos.insertados += 1;
    if (verbose) {
      console.log(`Equipo ${row.id} ${dryRun ? "preparado" : "migrado"} -> ${destinoEquipoId ?? "nuevo"}`);
    }
  }
}

function printSummary(summary) {
  console.log("\nResumen de migracion:");
  console.log(`- CasasMatrices: insertadas=${summary.casasMatrices.insertadas}, reutilizadas=${summary.casasMatrices.reutilizadas}`);
  console.log(`- Sucursales: insertadas=${summary.sucursales.insertadas}, reutilizadas=${summary.sucursales.reutilizadas}, sinCasaMatriz=${summary.sucursales.sinCasaMatriz.length}, sinEstado=${summary.sucursales.sinEstado.length}`);
  console.log(`- TipoEquipos: insertados=${summary.tipoEquipos.insertados}, reutilizados=${summary.tipoEquipos.reutilizados}`);
  console.log(`- Equipos: insertados=${summary.equipos.insertados}, reutilizados=${summary.equipos.reutilizados}, omitidos=${summary.equipos.omitidos.length}`);

  if (summary.equipos.omitidos.length > 0) {
    console.log("\nEquipos omitidos por dependencias faltantes:");
    for (const item of summary.equipos.omitidos) {
      console.log(`  - ${item.id}: ${item.missing.join(", ")}`);
    }
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
    sucursales: { insertadas: 0, reutilizadas: 0, sinCasaMatriz: [], sinEstado: [] },
    tipoEquipos: { insertados: 0, reutilizados: 0 },
    equipos: { insertados: 0, reutilizados: 0, omitidos: [] },
  };

  try {
    sourceConnection = await mysql.createConnection(sourceConfig);
    targetConnection = await mysql.createConnection(targetConfig);

    console.log(`Origen: ${sourceConfig.host}:${sourceConfig.port}/${sourceConfig.database}`);
    console.log(`Destino: ${targetConfig.host}:${targetConfig.port}/${targetConfig.database}`);

    await ensureMigrationMapTable(targetConnection);
    await targetConnection.beginTransaction();

    const casaMatrizMap = await migrateCasasMatrices(sourceConnection, targetConnection, summary);
    const sucursalMap = await migrateSucursales(
      sourceConnection,
      targetConnection,
      casaMatrizMap,
      summary,
    );
    const tipoEquipoMap = await migrateTipoEquipos(sourceConnection, targetConnection, summary);
    const estadoEquipoContext = await migrateEstadoEquipos(sourceConnection, targetConnection);

    await migrateEquipos(
      sourceConnection,
      targetConnection,
      sourceConfig.database,
      casaMatrizMap,
      sucursalMap,
      tipoEquipoMap,
      estadoEquipoContext,
      summary,
    );

    if (dryRun) {
      await targetConnection.rollback();
    } else {
      await targetConnection.commit();
    }

    printSummary(summary);
  } catch (error) {
    const enrichedError = await buildConnectionError(error, sourceConfig, targetConfig);

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
    console.error("Error al migrar equipos desde terreno:", enrichedError.message);
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
