import { DataTypes } from "sequelize";
import db from "../config/db.js";

const TABLE_NAME = "Cuentas";
const COLUMN_NAME = "modulosAcceso";

const run = async () => {
  try {
    await db.authenticate();
    const queryInterface = db.getQueryInterface();
    const tableDefinition = await queryInterface.describeTable(TABLE_NAME);

    if (tableDefinition[COLUMN_NAME]) {
      console.log(`La columna ${COLUMN_NAME} ya existe en ${TABLE_NAME}.`);
      return;
    }

    await queryInterface.addColumn(TABLE_NAME, COLUMN_NAME, {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    });

    console.log(`Columna ${COLUMN_NAME} agregada a ${TABLE_NAME}.`);
  } catch (error) {
    console.error(`Error al agregar ${COLUMN_NAME}:`, error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();
