import { DataTypes } from "sequelize";
import db from "../config/db.js";

const TABLE_NAME = "Tickets";
const COLUMN_NAME = "creatorEmail";

const run = async () => {
  try {
    await db.authenticate();
    const queryInterface = db.getQueryInterface();
    const tableDefinition = await queryInterface.describeTable(TABLE_NAME);

    if (!tableDefinition[COLUMN_NAME]) {
      await queryInterface.addColumn(TABLE_NAME, COLUMN_NAME, {
        type: DataTypes.STRING,
        allowNull: true,
      });
      console.log(`Columna ${COLUMN_NAME} agregada en ${TABLE_NAME}.`);
    } else {
      console.log(`La columna ${COLUMN_NAME} ya existe en ${TABLE_NAME}.`);
    }

    await db.query(`
      UPDATE Tickets t
      INNER JOIN Cuentas c ON c.id = t.creadoPorId
      SET t.creatorEmail = LOWER(TRIM(c.email))
      WHERE t.fuente = 'Web'
        AND c.email IS NOT NULL
        AND TRIM(c.email) <> ''
        AND (t.creatorEmail IS NULL OR TRIM(t.creatorEmail) = '');
    `);

    await db.query(`
      UPDATE Tickets t
      SET t.creatorEmail = LOWER(
        TRIM(
          SUBSTRING_INDEX(
            SUBSTRING_INDEX(t.descripcion, 'Correo original:', -1),
            '\n',
            1
          )
        )
      )
      WHERE t.fuente = 'Email'
        AND t.descripcion LIKE '%Correo original:%'
        AND (t.creatorEmail IS NULL OR TRIM(t.creatorEmail) = '');
    `);

    console.log(`Backfill de ${COLUMN_NAME} completado.`);
  } catch (error) {
    console.error(`Error al agregar/backfillear ${COLUMN_NAME}:`, error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();
