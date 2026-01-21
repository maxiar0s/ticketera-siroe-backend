import { Sequelize, QueryTypes } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: console.log,
  },
);

async function addCredencialesColumn() {
  try {
    await sequelize.authenticate();
    console.log("Conexión establecida.");

    // Verificar si la columna ya existe
    const [columns] = await sequelize.query(
      `SHOW COLUMNS FROM BibliotecaProyectos LIKE 'credenciales'`,
    );

    if (columns.length === 0) {
      console.log("Agregando columna credenciales...");
      await sequelize.query(
        `ALTER TABLE BibliotecaProyectos ADD COLUMN credenciales TEXT AFTER tecnologias`,
      );
      console.log("Columna credenciales agregada exitosamente.");
    } else {
      console.log("La columna credenciales ya existe.");
    }
  } catch (error) {
    console.error("Error al actualizar la tabla:", error);
  } finally {
    await sequelize.close();
  }
}

addCredencialesColumn();
