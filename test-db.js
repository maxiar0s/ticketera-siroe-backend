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

console.log("Intentando conectar a:", process.env.DB_HOST);
console.log("Puerto:", process.env.DB_PORT);
console.log("Base de datos:", process.env.DB_DATABASE_NAME);

sequelize
  .authenticate()
  .then(() => {
    console.log("✅ Conexión exitosa a la base de datos");
    return sequelize.query("SELECT 1+1 as result");
  })
  .then(([results]) => {
    console.log("✅ Query exitoso:", results);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error de conexión:", error.message);
    if (error.parent) {
      console.error("   Causa:", error.parent.message);
    }
    process.exit(1);
  });
