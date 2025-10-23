import { DataTypes } from "sequelize";
import db from "../config/db.js";

const TABLE_NAME = "Bitacoras";

const ensureColumn = async (queryInterface, tableDefinition, column, definition) => {
  if (tableDefinition[column]) {
    console.log(`La columna ${column} ya existe en ${TABLE_NAME}.`);
    return;
  }

  await queryInterface.addColumn(TABLE_NAME, column, definition);
  console.log(`Columna ${column} agregada a ${TABLE_NAME}.`);
};

const ensureNullable = async (queryInterface, tableDefinition, column, definition) => {
  const current = tableDefinition[column];
  if (!current) {
    console.warn(`La columna ${column} no existe en ${TABLE_NAME}, se omite cambio de nullabilidad.`);
    return;
  }

  if (current.allowNull) {
    console.log(`La columna ${column} ya permite valores nulos.`);
    return;
  }

  await queryInterface.changeColumn(TABLE_NAME, column, definition);
  console.log(`Nullabilidad actualizada para ${column}.`);
};

const run = async () => {
  try {
    await db.authenticate();
    const queryInterface = db.getQueryInterface();
    const tableDefinition = await queryInterface.describeTable(TABLE_NAME);

    await ensureColumn(queryInterface, tableDefinition, "estadoTicket", {
      type: DataTypes.STRING,
      allowNull: true,
    });

    await ensureColumn(queryInterface, tableDefinition, "fechaTermino", {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });

    await ensureColumn(queryInterface, tableDefinition, "detalleTermino", {
      type: DataTypes.TEXT,
      allowNull: true,
    });

    await ensureColumn(queryInterface, tableDefinition, "adjuntosTermino", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "[]",
    });

    await ensureNullable(queryInterface, tableDefinition, "horaLlegada", {
      type: DataTypes.DATE,
      allowNull: true,
    });

    await ensureNullable(queryInterface, tableDefinition, "horaSalida", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  } catch (error) {
    console.error("Error actualizando columnas de Bitacoras:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();
