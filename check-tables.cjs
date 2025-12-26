require("dotenv").config();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_DATABASE_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    dialectOptions: {
      ssl: {
        rejectUnauthorized: false,
      },
    },
  }
);

async function checkTables() {
  try {
    console.log("Base de datos:", process.env.DB_DATABASE_NAME);
    console.log("Host:", process.env.DB_HOST);
    console.log("");

    const [tables] = await sequelize.query("SHOW TABLES");

    if (tables.length === 0) {
      console.log("NO HAY TABLAS EN LA BASE DE DATOS!");
      console.log("");
      console.log("Solucion: Debes ejecutar la sincronizacion de Sequelize.");
      console.log("En el archivo api/index.js, descomenta la linea db.sync()");
      console.log("o ejecuta un script de seed/migracion.");
    } else {
      console.log("Tablas disponibles (" + tables.length + "):");
      tables.forEach((t) => console.log(" -", Object.values(t)[0]));
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await sequelize.close();
  }
}

checkTables();
