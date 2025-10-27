import { DataTypes } from "sequelize";
import db from "../config/db.js";

const TABLE_CLIENTES = "CasasMatrices";
const TABLE_EQUIPOS = "Equipos";

const ensureColumn = async (queryInterface, table, column, definition) => {
  const tableDefinition = await queryInterface.describeTable(table);
  if (tableDefinition[column]) {
    console.log(`La columna ${column} ya existe en ${table}.`);
    return false;
  }

  await queryInterface.addColumn(table, column, definition);
  console.log(`Columna ${column} agregada a ${table}.`);
  return true;
};

const run = async () => {
  try {
    await db.authenticate();
    const queryInterface = db.getQueryInterface();

    const agregoServicios = await ensureColumn(queryInterface, TABLE_CLIENTES, "servicios", {
      type: DataTypes.JSON,
      allowNull: true,
    });

    if (agregoServicios) {
      await queryInterface.sequelize.query(
        "UPDATE `CasasMatrices` SET `servicios` = JSON_ARRAY() WHERE `servicios` IS NULL;"
      );
      console.log("Valores iniciales de servicios establecidos en JSON_ARRAY().");
    }

    await ensureColumn(queryInterface, TABLE_EQUIPOS, "esArriendo", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    console.log("Actualización completada.");
  } catch (error) {
    console.error("Error al actualizar columnas:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();
