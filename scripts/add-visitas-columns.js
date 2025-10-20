import { DataTypes } from "sequelize";
import db from "../config/db.js";

const TABLE_NAME = "CasasMatrices";

const columnDefinitions = {
  visitasMensuales: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  visitasEmergenciaAnuales: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
};

const ensureColumn = async (queryInterface, table, column, definition) => {
  const tableDefinition = await queryInterface.describeTable(table);
  if (tableDefinition[column]) {
    console.log(`La columna ${column} ya existe en ${table}. Se omite.`);
    return;
  }

  await queryInterface.addColumn(table, column, definition);
  console.log(`Columna ${column} agregada a ${table}.`);
};

const run = async () => {
  try {
    await db.authenticate();
    const queryInterface = db.getQueryInterface();

    for (const [column, definition] of Object.entries(columnDefinitions)) {
      await ensureColumn(queryInterface, TABLE_NAME, column, definition);
    }

    console.log("Actualización de columnas completada.");
  } catch (error) {
    console.error("Error al actualizar columnas de CasasMatrices:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();