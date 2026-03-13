import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const sourceEnvPath = path.resolve(rootDir, process.env.PROD_ENV_FILE || ".env");
const targetEnvPath = path.resolve(rootDir, process.env.LOCAL_ENV_FILE || ".env.local");

const batchSize = Number(process.env.MIGRATION_BATCH_SIZE || 500);
const dryRun = process.argv.includes("--dry-run");

function loadEnvFile(envPath) {
  const envContent = fs.readFileSync(envPath, "utf8");
  return dotenv.parse(envContent);
}

function getValue(envVars, fileKey, overrideKey) {
  return process.env[overrideKey] || envVars[fileKey];
}

function buildDbConfig(envVars, options = {}) {
  const host = getValue(envVars, "DB_HOST", options.hostOverrideKey);
  const port = Number(getValue(envVars, "DB_PORT", options.portOverrideKey));
  const user = getValue(envVars, "DB_USER", options.userOverrideKey);
  const password = getValue(envVars, "DB_PASSWORD", options.passwordOverrideKey);
  const database = getValue(envVars, "DB_DATABASE_NAME", options.databaseOverrideKey);
  const sslEnabled = options.sslEnabled ?? false;

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    multipleStatements: false,
  };
}

function inferSsl(config) {
  return config.host?.includes("ondigitalocean.com") || Number(config.port) === 25060;
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, "``")}\``;
}

function buildInsertStatement(tableName, columns, rows) {
  const columnSql = columns.map((column) => quoteIdentifier(column)).join(", ");
  const rowPlaceholders = rows.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
  const values = [];

  for (const row of rows) {
    for (const column of columns) {
      values.push(normalizeValue(row[column]));
    }
  }

  return {
    sql: `INSERT INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES ${rowPlaceholders}`,
    values,
  };
}

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value);
  }

  return value;
}

function parseTablesArg() {
  const tablesArg = process.argv.find((arg) => arg.startsWith("--tables="));
  if (!tablesArg) {
    return null;
  }

  return tablesArg
    .slice("--tables=".length)
    .split(",")
    .map((table) => table.trim())
    .filter(Boolean);
}

async function getBaseTables(connection, database) {
  const [rows] = await connection.query(
    `
      SELECT TABLE_NAME
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
      ORDER BY TABLE_NAME ASC
    `,
    [database],
  );

  return rows.map((row) => row.TABLE_NAME);
}

async function getTableColumns(connection, database, tableName) {
  const [rows] = await connection.query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
      ORDER BY ORDINAL_POSITION ASC
    `,
    [database, tableName],
  );

  return rows.map((row) => row.COLUMN_NAME);
}

async function getTableCount(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total FROM ${quoteIdentifier(tableName)}`,
  );

  return Number(rows[0]?.total || 0);
}

async function clearTargetTables(connection, tables) {
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");

  try {
    for (const tableName of tables) {
      await connection.query(`DELETE FROM ${quoteIdentifier(tableName)}`);
      await connection.query(`ALTER TABLE ${quoteIdentifier(tableName)} AUTO_INCREMENT = 1`);
    }
  } finally {
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }
}

async function copyTableData(sourceConnection, targetConnection, sourceDatabase, targetDatabase, tableName) {
  const sourceColumns = await getTableColumns(sourceConnection, sourceDatabase, tableName);
  const targetColumns = await getTableColumns(targetConnection, targetDatabase, tableName);
  const targetColumnSet = new Set(targetColumns);
  const commonColumns = sourceColumns.filter((column) => targetColumnSet.has(column));

  if (!commonColumns.length) {
    console.log(`- ${tableName}: omitida, no hay columnas compatibles.`);
    return;
  }

  const totalRows = await getTableCount(sourceConnection, tableName);
  if (!totalRows) {
    console.log(`- ${tableName}: sin registros para copiar.`);
    return;
  }

  const columnSql = commonColumns.map((column) => quoteIdentifier(column)).join(", ");

  let offset = 0;
  while (offset < totalRows) {
    const [rows] = await sourceConnection.query(
      `SELECT ${columnSql} FROM ${quoteIdentifier(tableName)} LIMIT ? OFFSET ?`,
      [batchSize, offset],
    );

    if (!rows.length) {
      break;
    }

    const insertStatement = buildInsertStatement(tableName, commonColumns, rows);
    await targetConnection.query(insertStatement.sql, insertStatement.values);
    offset += rows.length;
  }

  console.log(`- ${tableName}: ${totalRows} registros copiados.`);
}

async function main() {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("MIGRATION_BATCH_SIZE debe ser un entero mayor a 0.");
  }

  const sourceEnv = loadEnvFile(sourceEnvPath);
  const targetEnv = loadEnvFile(targetEnvPath);

  const sourceConfig = buildDbConfig(sourceEnv, {
    hostOverrideKey: "PROD_DB_HOST",
    portOverrideKey: "PROD_DB_PORT",
    userOverrideKey: "PROD_DB_USER",
    passwordOverrideKey: "PROD_DB_PASSWORD",
    databaseOverrideKey: "PROD_DB_DATABASE_NAME",
  });
  sourceConfig.ssl = inferSsl(sourceConfig) ? { rejectUnauthorized: false } : undefined;

  const targetConfig = buildDbConfig(targetEnv, {
    hostOverrideKey: "LOCAL_DB_HOST",
    portOverrideKey: "LOCAL_DB_PORT",
    userOverrideKey: "LOCAL_DB_USER",
    passwordOverrideKey: "LOCAL_DB_PASSWORD",
    databaseOverrideKey: "LOCAL_DB_DATABASE_NAME",
    sslEnabled: false,
  });

  let sourceConnection;
  let targetConnection;

  try {
    sourceConnection = await mysql.createConnection(sourceConfig);
    targetConnection = await mysql.createConnection(targetConfig);

    const sourceTables = await getBaseTables(sourceConnection, sourceConfig.database);
    const targetTables = await getBaseTables(targetConnection, targetConfig.database);
    const requestedTables = parseTablesArg();

    const targetTableSet = new Set(targetTables);
    const sourceTableSet = new Set(sourceTables);
    const commonTables = sourceTables.filter((tableName) => targetTableSet.has(tableName));
    const tablesToCopy = requestedTables
      ? commonTables.filter((tableName) => requestedTables.includes(tableName))
      : commonTables;

    if (!tablesToCopy.length) {
      throw new Error("No se encontraron tablas comunes para copiar entre prod y local.");
    }

    const sourceOnlyTables = sourceTables.filter((tableName) => !targetTableSet.has(tableName));
    const targetOnlyTables = targetTables.filter((tableName) => !sourceTableSet.has(tableName));

    console.log(`Origen: ${sourceConfig.host}:${sourceConfig.port}/${sourceConfig.database}`);
    console.log(`Destino: ${targetConfig.host}:${targetConfig.port}/${targetConfig.database}`);
    console.log(`Tablas a copiar: ${tablesToCopy.length}`);

    if (sourceOnlyTables.length) {
      console.log(`Tablas solo en prod: ${sourceOnlyTables.join(", ")}`);
    }

    if (targetOnlyTables.length) {
      console.log(`Tablas solo en local: ${targetOnlyTables.join(", ")}`);
    }

    if (dryRun) {
      console.log("Dry run completado. No se modifico la base local.");
      return;
    }

    await clearTargetTables(targetConnection, tablesToCopy);
    await targetConnection.query("SET FOREIGN_KEY_CHECKS = 0");

    try {
      for (const tableName of tablesToCopy) {
        try {
          await copyTableData(
            sourceConnection,
            targetConnection,
            sourceConfig.database,
            targetConfig.database,
            tableName,
          );
        } catch (error) {
          throw new Error(`Tabla ${tableName}: ${error.message}`);
        }
      }
    } finally {
      await targetConnection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    console.log("Migracion completada correctamente.");
  } finally {
    if (sourceConnection) {
      await sourceConnection.end();
    }

    if (targetConnection) {
      await targetConnection.end();
    }
  }
}

main().catch((error) => {
  console.error("Error copiando datos de prod a local:", error.message);
  process.exit(1);
});
