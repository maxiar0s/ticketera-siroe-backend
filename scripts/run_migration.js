import db from "../config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
  try {
    console.log("Conectando a la base de datos...");
    await db.authenticate();
    console.log("Conexión exitosa.");

    const sqlPath = path.join(__dirname, "update_ticket_states.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // 1. Remove comments (lines starting with --)
    const cleanSql = sqlContent
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    // 2. Split by semicolon
    const queries = cleanSql
      .split(";")
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    console.log(`Encontradas ${queries.length} sentencias SQL para ejecutar.`);

    for (const query of queries) {
      console.log(`Ejecutando: ${query.substring(0, 50)}...`);
      await db.query(query);
    }

    console.log("Migración completada exitosamente.");
    process.exit(0);
  } catch (error) {
    console.error("Error durante la migración:", error);
    process.exit(1);
  }
};

runMigration();
