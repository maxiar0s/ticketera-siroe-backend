import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

loadEnv();

function loadEnv() {
  const envLocalPath = path.resolve(rootDir, ".env.local");
  const envPath = path.resolve(rootDir, ".env");

  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: false });
  }

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

function parseArgs(argv) {
  const options = {
    fromId: null,
    toId: null,
    fromName: null,
    toName: null,
    dryRun: argv.includes("--dry-run"),
    verbose: argv.includes("--verbose"),
  };

  for (const arg of argv) {
    if (!arg.startsWith("--") || !arg.includes("=")) {
      continue;
    }

    const [rawKey, ...rawValueParts] = arg.slice(2).split("=");
    const value = rawValueParts.join("=").trim();

    switch (rawKey) {
      case "from-id":
        options.fromId = value;
        break;
      case "to-id":
        options.toId = value;
        break;
      case "from-name":
        options.fromName = value;
        break;
      case "to-name":
        options.toName = value;
        break;
      default:
        break;
    }
  }

  return options;
}

function buildDbConfig() {
  const rawHost = process.env.DB_HOST;
  const rawPort = Number(process.env.DB_PORT);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_DATABASE_NAME;

  const host = rawHost === "mysql" ? "127.0.0.1" : rawHost;
  const port = rawHost === "mysql"
    ? Number(process.env.TARGET_MYSQL_HOST_PORT || process.env.MYSQL_HOST_PORT || 3307)
    : rawPort;

  if (!host || !port || !user || database == null) {
    throw new Error(
      "Configuracion DB incompleta. Revisa DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_DATABASE_NAME.",
    );
  }

  return {
    host,
    port,
    user,
    password,
    database,
    ssl:
      `${host}`.includes("ondigitalocean.com") || Number(port) === 25060
        ? { rejectUnauthorized: false }
        : undefined,
  };
}

async function resolveCasaMatriz(connection, { id, name }, label) {
  if (id) {
    const [rows] = await connection.query(
      "SELECT id, rut, razonSocial FROM CasasMatrices WHERE id = ? LIMIT 1",
      [id],
    );

    if (!rows.length) {
      throw new Error(`No se encontro la casa matriz ${label} con id '${id}'.`);
    }

    return rows[0];
  }

  if (!name) {
    throw new Error(`Debes indicar --${label}-id o --${label}-name.`);
  }

  const [rows] = await connection.query(
    "SELECT id, rut, razonSocial FROM CasasMatrices WHERE razonSocial = ? LIMIT 2",
    [name],
  );

  if (!rows.length) {
    throw new Error(`No se encontro la casa matriz ${label} con nombre '${name}'.`);
  }

  if (rows.length > 1) {
    throw new Error(`El nombre '${name}' para ${label} no es unico. Usa --${label}-id.`);
  }

  return rows[0];
}

async function loadTicketsToMove(connection, fromCasaMatrizId) {
  const [rows] = await connection.query(
    `
      SELECT id, titulo, casaMatrizId, sucursalId, createdAt
      FROM Tickets
      WHERE casaMatrizId = ?
      ORDER BY id ASC
    `,
    [fromCasaMatrizId],
  );

  return rows;
}

async function countRelatedRows(connection, ticketIds) {
  if (!ticketIds.length) {
    return { actividades: 0, mensajes: 0, tags: 0 };
  }

  const placeholders = ticketIds.map(() => "?").join(", ");

  const [[actividadesRows], [mensajesRows], [tagsRows]] = await Promise.all([
    connection.query(
      `SELECT COUNT(*) AS total FROM ActividadesTicket WHERE ticketId IN (${placeholders})`,
      ticketIds,
    ),
    connection.query(
      `SELECT COUNT(*) AS total FROM MensajesTicket WHERE ticketId IN (${placeholders})`,
      ticketIds,
    ),
    connection.query(
      `SELECT COUNT(*) AS total FROM TicketTags WHERE ticketId IN (${placeholders})`,
      ticketIds,
    ),
  ]);

  return {
    actividades: Number(actividadesRows[0]?.total || 0),
    mensajes: Number(mensajesRows[0]?.total || 0),
    tags: Number(tagsRows[0]?.total || 0),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = buildDbConfig();
  const connection = await mysql.createConnection(config);

  try {
    const fromCasaMatriz = await resolveCasaMatriz(
      connection,
      { id: options.fromId, name: options.fromName },
      "from",
    );
    const toCasaMatriz = await resolveCasaMatriz(
      connection,
      { id: options.toId, name: options.toName },
      "to",
    );

    if (fromCasaMatriz.id === toCasaMatriz.id) {
      throw new Error("La casa matriz origen y destino son la misma.");
    }

    const tickets = await loadTicketsToMove(connection, fromCasaMatriz.id);
    const ticketIds = tickets.map((ticket) => ticket.id);
    const relatedCounts = await countRelatedRows(connection, ticketIds);

    console.log(`Origen: ${fromCasaMatriz.razonSocial} (${fromCasaMatriz.id})`);
    console.log(`Destino: ${toCasaMatriz.razonSocial} (${toCasaMatriz.id})`);
    console.log(`Tickets a mover: ${tickets.length}`);
    console.log(
      `Registros relacionados preservados: actividades=${relatedCounts.actividades}, mensajes=${relatedCounts.mensajes}, tags=${relatedCounts.tags}`,
    );

    if (options.verbose && tickets.length > 0) {
      console.log("\nTickets detectados:");
      for (const ticket of tickets) {
        console.log(`- ${ticket.id}: ${ticket.titulo || "(sin titulo)"}`);
      }
    }

    if (!tickets.length) {
      console.log(`\nModo: ${options.dryRun ? "dry-run" : "ejecucion real"}`);
      console.log("No hay tickets por reasignar.");
      return;
    }

    await connection.beginTransaction();

    if (!options.dryRun) {
      await connection.query(
        "UPDATE Tickets SET casaMatrizId = ? WHERE casaMatrizId = ?",
        [toCasaMatriz.id, fromCasaMatriz.id],
      );
    }

    if (options.dryRun) {
      await connection.rollback();
    } else {
      await connection.commit();
    }

    console.log(`\nModo: ${options.dryRun ? "dry-run (rollback)" : "ejecucion real"}`);
    console.log(
      `${options.dryRun ? "Se reasignarian" : "Se reasignaron"} ${tickets.length} tickets de '${fromCasaMatriz.razonSocial}' a '${toCasaMatriz.razonSocial}'.`,
    );
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_rollbackError) {
      // ignore rollback error
    }

    console.error("Error al reasignar tickets:", error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
