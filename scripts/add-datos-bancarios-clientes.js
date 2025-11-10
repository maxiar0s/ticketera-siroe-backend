import { DataTypes } from "sequelize";
import db from "../config/db.js";

const TABLE_NAME = "CasasMatrices";

const COLUMNS = [
  { name: "banco", definition: { type: DataTypes.STRING(120), allowNull: true } },
  { name: "tipoCuentaBancaria", definition: { type: DataTypes.STRING(60), allowNull: true } },
  { name: "numeroCuentaBancaria", definition: { type: DataTypes.STRING(50), allowNull: true } },
  { name: "titularCuenta", definition: { type: DataTypes.STRING(120), allowNull: true } },
  { name: "rutTitularCuenta", definition: { type: DataTypes.STRING(20), allowNull: true } },
  { name: "correoNotificacionPago", definition: { type: DataTypes.STRING(120), allowNull: true } },
];

const run = async () => {
  try {
    await db.authenticate();
    const queryInterface = db.getQueryInterface();
    const tableDefinition = await queryInterface.describeTable(TABLE_NAME);

    for (const column of COLUMNS) {
      if (tableDefinition[column.name]) {
        console.log(`La columna ${column.name} ya existe en ${TABLE_NAME}.`);
        continue;
      }

      await queryInterface.addColumn(TABLE_NAME, column.name, column.definition);
      console.log(`Columna ${column.name} agregada a ${TABLE_NAME}.`);
    }

    console.log("Verificacion de columnas de datos bancarios finalizada.");
  } catch (error) {
    console.error("Error al asegurar las columnas de datos bancarios:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();
