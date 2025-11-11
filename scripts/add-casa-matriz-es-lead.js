import { DataTypes } from "sequelize";
import db from "../config/db.js";

const TABLE_NAME = "CasasMatrices";

const COLUMNS_TO_ALLOW_NULL = {
  rut: { type: DataTypes.STRING(20), allowNull: true },
  razonSocial: { type: DataTypes.STRING(255), allowNull: true },
  encargadoGeneral: { type: DataTypes.STRING(255), allowNull: true },
  correo: { type: DataTypes.STRING(255), allowNull: true },
  telefonoEncargado: { type: DataTypes.INTEGER, allowNull: true },
  visitasMensuales: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  visitasEmergenciaAnuales: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
};

const run = async () => {
  try {
    await db.authenticate();
    const queryInterface = db.getQueryInterface();
    const tableDefinition = await queryInterface.describeTable(TABLE_NAME);

    if (!tableDefinition.esLead) {
      await queryInterface.addColumn(TABLE_NAME, "esLead", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      console.log("Columna esLead agregada correctamente.");
    } else {
      console.log("La columna esLead ya existe, no se realizan cambios.");
    }

    for (const [column, definition] of Object.entries(COLUMNS_TO_ALLOW_NULL)) {
      const current = tableDefinition[column];
      if (!current) {
        console.warn(`La columna ${column} no existe en ${TABLE_NAME}.`);
        continue;
      }

      if (!current.allowNull || current.defaultValue !== definition.defaultValue) {
        await queryInterface.changeColumn(TABLE_NAME, column, definition);
        console.log(`Se actualizó la nullabilidad de ${column}.`);
      } else {
        console.log(`La columna ${column} ya permite valores nulos.`);
      }
    }
  } catch (error) {
    console.error("Error al asegurar columnas de Casa Matriz:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();
