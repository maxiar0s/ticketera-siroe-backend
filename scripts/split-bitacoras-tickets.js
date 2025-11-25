import { DataTypes } from "sequelize";
import db from "../config/db.js";

const BITACORAS_TABLE = "Bitacoras";
const TICKETS_TABLE = "Tickets";

const normalizeTableName = (table) => table.toLowerCase();

const tableExists = async (queryInterface, tableName) => {
  const tables = await queryInterface.showAllTables();
  return tables
    .map((table) =>
      typeof table === "string" ? table : table?.tableName || table?.name
    )
    .filter(Boolean)
    .map(normalizeTableName)
    .includes(normalizeTableName(tableName));
};

const ensureIndex = async (queryInterface, tableName, options) => {
  const indexes = await queryInterface.showIndex(tableName);
  const exists = indexes.some((index) => index.name === options.name);
  if (!exists) {
    await queryInterface.addIndex(tableName, { ...options });
    console.log(`Indice ${options.name} creado en ${tableName}.`);
  }
};

const ensureTicketsTable = async (queryInterface) => {
  const exists = await tableExists(queryInterface, TICKETS_TABLE);
  if (!exists) {
    await queryInterface.createTable(TICKETS_TABLE, {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      titulo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      tecnicos: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "[]",
      },
      fechaVisita: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      horaLlegada: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      horaSalida: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      casaMatrizId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sucursalId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      creadoPorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      actualizadoPorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      adjuntos: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: "[]",
      },
      adjuntosTermino: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: "[]",
      },
      isEmergencia: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      estadoTicket: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "ingresado",
      },
      fechaTermino: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      detalleTermino: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      proyectoId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
      },
      updatedAt: {
        type: DataTypes.DATE,
      },
    });
    console.log(`Tabla ${TICKETS_TABLE} creada.`);
  }

  await ensureIndex(queryInterface, TICKETS_TABLE, {
    fields: ["casaMatrizId"],
    name: "idx_tickets_casaMatrizId",
  });
  await ensureIndex(queryInterface, TICKETS_TABLE, {
    fields: ["estadoTicket"],
    name: "idx_tickets_estadoTicket",
  });
  await ensureIndex(queryInterface, TICKETS_TABLE, {
    fields: ["proyectoId"],
    name: "idx_tickets_proyectoId",
  });
};

const normalizeArrayColumn = (value) => {
  if (!value) {
    return "[]";
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return JSON.stringify(parsed);
      }
    } catch (_err) {
      // fallback
    }
    return JSON.stringify([value]);
  }
  return "[]";
};

const migrateTickets = async (queryInterface) => {
  const bitacoraDefinition = await queryInterface.describeTable(BITACORAS_TABLE);
  const hasEsTicket = !!bitacoraDefinition.esTicket;

  if (!hasEsTicket) {
    console.log("Bitacoras ya no tiene columna esTicket. No hay migracion pendiente.");
    return;
  }

  const [ticketsExistentes] = await queryInterface.sequelize.query(
    `SELECT id FROM "${TICKETS_TABLE}"`
  );
  const existentesSet = new Set(
    Array.isArray(ticketsExistentes)
      ? ticketsExistentes.map((row) => row.id)
      : []
  );

  const [ticketsOrigen] = await queryInterface.sequelize.query(
    `SELECT * FROM "${BITACORAS_TABLE}" WHERE "esTicket" = TRUE`
  );

  const registros = Array.isArray(ticketsOrigen) ? ticketsOrigen : [];
  const paraInsertar = registros
    .filter((row) => !existentesSet.has(row.id))
    .map((row) => ({
      id: row.id,
      titulo: row.titulo ?? null,
      descripcion: row.descripcion ?? "",
      tecnicos: normalizeArrayColumn(row.tecnicos),
      fechaVisita: row.fechaVisita,
      horaLlegada: row.horaLlegada ?? null,
      horaSalida: row.horaSalida ?? null,
      casaMatrizId: row.casaMatrizId,
      sucursalId: row.sucursalId ?? null,
      creadoPorId: row.creadoPorId ?? 1,
      actualizadoPorId: row.actualizadoPorId ?? row.creadoPorId ?? 1,
      adjuntos: normalizeArrayColumn(row.adjuntos),
      adjuntosTermino: normalizeArrayColumn(row.adjuntosTermino),
      isEmergencia: !!row.isEmergencia,
      estadoTicket: row.estadoTicket ?? "ingresado",
      fechaTermino: row.fechaTermino ?? null,
      detalleTermino: row.detalleTermino ?? null,
      proyectoId:
        row.proyectoId === null || typeof row.proyectoId === "undefined"
          ? null
          : row.proyectoId,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? row.createdAt ?? new Date(),
    }));

  if (paraInsertar.length) {
    await queryInterface.bulkInsert(TICKETS_TABLE, paraInsertar);
    console.log(`Tickets migrados: ${paraInsertar.length}`);
  } else {
    console.log("No hay tickets nuevos para migrar.");
  }

  // Limpiar tickets de la tabla Bitacoras
  await queryInterface.bulkDelete(BITACORAS_TABLE, { esTicket: true });
  console.log("Registros de tickets removidos desde Bitacoras.");

  // Eliminar columnas de ticket en Bitacoras
  const columnasEliminar = ["esTicket", "estadoTicket", "fechaTermino", "detalleTermino"];
  for (const columna of columnasEliminar) {
    const definicion = await queryInterface.describeTable(BITACORAS_TABLE);
    if (definicion[columna]) {
      await queryInterface.removeColumn(BITACORAS_TABLE, columna);
      console.log(`Columna ${columna} eliminada de ${BITACORAS_TABLE}.`);
    }
  }
};

const run = async () => {
  try {
    await db.authenticate();
    const queryInterface = db.getQueryInterface();

    await ensureTicketsTable(queryInterface);
    await migrateTickets(queryInterface);

    console.log("Separacion de bitacoras y tickets completada.");
  } catch (error) {
    console.error("Error al separar bitacoras y tickets:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();
