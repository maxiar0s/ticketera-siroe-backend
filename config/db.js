import { Sequelize } from "sequelize";
import dotenv from "dotenv/config";
import mysql2 from "mysql2";

const db = new Sequelize({
  dialect: "mysql",
  dialectModule: mysql2,
  database: process.env.DB_DATABASE_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialectOptions: {
    connectTimeout: 60000, // Increase connection timeout to 60 seconds
    ssl: {
      rejectUnauthorized: false, // DigitalOcean managed databases require SSL
    },
  },
  pool: {
    max: 30, // Máximo de conexiones en el pool
    min: 5, // Mínimo de conexiones a mantener
    acquire: 60000, // Tiempo máximo para adquirir una conexión (60s)
    idle: 10000, // Tiempo máximo que una conexión puede estar inactiva (10s)
  },
  retry: {
    max: 3, // Reintentar hasta 3 veces en caso de error
  },
});

export default db;
