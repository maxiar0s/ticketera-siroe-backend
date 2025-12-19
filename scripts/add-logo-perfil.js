import db from "../config/db.js";

/**
 * Migración: Agregar columna logoPerfil a la tabla CasasMatrices
 *
 * Ejecutar con: node scripts/add-logo-perfil.js
 */

const run = async () => {
  try {
    console.log("Conectando a la base de datos...");
    await db.authenticate();
    console.log("Conexión exitosa.");

    // Verificar si la columna ya existe
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'CasasMatrices' 
        AND COLUMN_NAME = 'logoPerfil'
    `);

    if (columns.length > 0) {
      console.log(
        "ℹ️  La columna logoPerfil ya existe. No se requiere acción."
      );
      process.exit(0);
    }

    console.log("Agregando columna logoPerfil a CasasMatrices...");
    await db.query(`
      ALTER TABLE CasasMatrices 
      ADD COLUMN logoPerfil VARCHAR(255) NULL 
      AFTER imagen
    `);

    console.log("✅ Columna logoPerfil agregada exitosamente.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante la migración:", error.message);
    process.exit(1);
  }
};

run();
