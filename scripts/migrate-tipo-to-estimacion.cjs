/**
 * Script de migración para reemplazar el campo 'tipo' por 'estimacion' en la tabla Tickets.
 *
 * IMPORTANTE: Ejecutar este script UNA SOLA VEZ antes de desplegar los cambios.
 *
 * Uso: node scripts/migrate-tipo-to-estimacion.cjs
 */

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
    logging: console.log,
  }
);

async function migrate() {
  console.log("\n=== Migración: tipo -> estimacion ===\n");

  try {
    await sequelize.authenticate();
    console.log("✅ Conexión a BD exitosa\n");

    // 1. Verificar si la columna 'tipo' existe
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM Tickets LIKE 'tipo'"
    );

    if (columns.length === 0) {
      console.log(
        '⚠️  La columna "tipo" no existe. Puede que ya haya sido migrada.'
      );
    } else {
      console.log('📍 Columna "tipo" encontrada, procediendo a eliminar...');

      // 2. Eliminar la columna 'tipo'
      await sequelize.query("ALTER TABLE Tickets DROP COLUMN tipo");
      console.log('✅ Columna "tipo" eliminada correctamente');
    }

    // 3. Verificar si la columna 'estimacion' ya existe
    const [estColumns] = await sequelize.query(
      "SHOW COLUMNS FROM Tickets LIKE 'estimacion'"
    );

    if (estColumns.length > 0) {
      console.log('✅ La columna "estimacion" ya existe');
    } else {
      console.log('📍 Agregando columna "estimacion"...');

      // 4. Agregar la columna 'estimacion' (FLOAT, nullable)
      await sequelize.query(
        "ALTER TABLE Tickets ADD COLUMN estimacion FLOAT NULL DEFAULT NULL"
      );
      console.log('✅ Columna "estimacion" agregada correctamente');
    }

    console.log("\n=== Migración completada exitosamente ===\n");
  } catch (error) {
    console.error("\n❌ Error durante la migración:");
    console.error("   ", error.message);
    if (error.parent) {
      console.error("   SQL Error:", error.parent.message);
    }
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
