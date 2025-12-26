require("dotenv").config();
const { Sequelize, DataTypes, Op } = require("sequelize");

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
    logging: console.log,
  }
);

async function testQueries() {
  try {
    console.log("=== Probando conexion ===");
    await sequelize.authenticate();
    console.log("Conexion OK\n");

    console.log("=== Probando tabla tickets ===");
    const [tickets] = await sequelize.query(
      "SELECT COUNT(*) as count FROM tickets"
    );
    console.log("Tickets count:", tickets[0].count);

    console.log("\n=== Probando tabla notificaciones ===");
    try {
      const [notificaciones] = await sequelize.query(
        "SELECT COUNT(*) as count FROM notificaciones"
      );
      console.log("Notificaciones count:", notificaciones[0].count);
    } catch (err) {
      console.error("Error en tabla notificaciones:", err.message);
    }

    console.log("\n=== Listando todas las tablas ===");
    const [tables] = await sequelize.query("SHOW TABLES");
    console.log("Tablas disponibles:");
    tables.forEach((t) => console.log(" -", Object.values(t)[0]));

    console.log("\n=== Probando estructura de tickets ===");
    try {
      const [ticketSample] = await sequelize.query(
        "SELECT * FROM tickets LIMIT 1"
      );
      console.log("Columnas en tickets:", Object.keys(ticketSample[0] || {}));
    } catch (err) {
      console.error("Error obteniendo sample de tickets:", err.message);
    }

    console.log("\n=== Probando query con relaciones ===");
    try {
      const [result] = await sequelize.query(`
        SELECT t.*, cm.razonSocial 
        FROM tickets t 
        LEFT JOIN casas_matrices cm ON t.casaMatrizId = cm.id 
        LIMIT 1
      `);
      console.log("Query con JOIN exitoso");
    } catch (err) {
      console.error("Error en query con JOIN:", err.message);
    }
  } catch (error) {
    console.error("Error general:", error.message);
    if (error.parent) {
      console.error("Causa:", error.parent.message);
    }
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

testQueries();
