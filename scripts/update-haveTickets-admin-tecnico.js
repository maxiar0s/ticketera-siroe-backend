import db from "../config/db.js";

const TABLE_NAME = "Cuentas";

const run = async () => {
  try {
    await db.authenticate();
    const queryInterface = db.getQueryInterface();

    await queryInterface.sequelize.query(
      `UPDATE \`${TABLE_NAME}\` SET haveTickets = 1 WHERE tipoCuentaId IN (1, 2);`
    );

    console.log(
      "Columna haveTickets actualizada para cuentas de tipo Administrador y Tecnico."
    );
  } catch (error) {
    console.error("Error al actualizar haveTickets:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();
