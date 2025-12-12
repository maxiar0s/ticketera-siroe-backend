/**
 * Script de migración para crear las tablas de Tags y TicketTags
 * Ejecutar con: node scripts/add-tags-tables.js
 */

import db from "../config/db.js";
import { TagModel, TicketTagModel } from "../models/index.js";

const migrate = async () => {
  try {
    console.log("Conectando a la base de datos...");
    await db.authenticate();
    console.log("Conexión establecida correctamente.");

    console.log("Creando tabla Tags...");
    await TagModel.sync({ force: false });
    console.log("Tabla Tags creada exitosamente.");

    console.log("Creando tabla TicketTags...");
    await TicketTagModel.sync({ force: false });
    console.log("Tabla TicketTags creada exitosamente.");

    console.log("\n✅ Migración completada exitosamente.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    process.exit(1);
  }
};

migrate();
