import { Sequelize } from "sequelize";
import dotenv from 'dotenv/config';
import mysql2 from 'mysql2';

const db = new Sequelize({
    dialect: "mysql",
    dialectModule: mysql2,
    database: process.env.DB_DATABASE_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialectOptions: {
        connectTimeout: 60000 // Increase connection timeout to 60 seconds
    }
})

export default db