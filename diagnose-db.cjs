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
    console.log("\n=== 1. Probando conexion ===");
    await sequelize.authenticate();
    console.log("Conexion OK");

    console.log("\n=== 2. Probando SELECT en Tickets ===");
    const [tickets] = await sequelize.query(
      "SELECT COUNT(*) as count FROM Tickets"
    );
    console.log("Tickets count:", tickets[0].count);

    console.log("\n=== 3. Probando SELECT en Notificaciones ===");
    const [notificaciones] = await sequelize.query(
      "SELECT COUNT(*) as count FROM Notificaciones"
    );
    console.log("Notificaciones count:", notificaciones[0].count);

    console.log("\n=== 4. Probando SELECT en Cuentas (para /perfil) ===");
    const [cuentas] = await sequelize.query(
      "SELECT id, name, email FROM Cuentas LIMIT 1"
    );
    console.log("Cuenta sample:", cuentas[0]);

    console.log("\n=== 5. Probando JOINs complejos (como en tickets) ===");
    const [ticketJoin] = await sequelize.query(`
      SELECT t.id, t.titulo, cm.razonSocial as cliente
      FROM Tickets t 
      LEFT JOIN CasasMatrices cm ON t.casaMatrizId = cm.id 
      LIMIT 1
    `);
    console.log("Ticket con JOIN:", ticketJoin[0] || "Sin resultados");

    console.log("\n=== 6. Probando MensajesTicket ===");
    const [mensajes] = await sequelize.query(
      "SELECT COUNT(*) as count FROM MensajesTicket"
    );
    console.log("MensajesTicket count:", mensajes[0].count);

    console.log("\n=== TODOS LOS TESTS PASARON ===");
  } catch (error) {
    console.error("\n!!! ERROR !!!");
    console.error("Mensaje:", error.message);
    if (error.parent) {
      console.error("Causa SQL:", error.parent.message);
      console.error("SQL:", error.parent.sql);
    }
    if (error.original) {
      console.error("Original:", error.original.message);
    }
  } finally {
    await sequelize.close();
  }
}

testQueries();
