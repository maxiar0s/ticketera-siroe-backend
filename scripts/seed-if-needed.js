import mysql from 'mysql2/promise';
import { spawn } from 'node:child_process';

const maxRetries = 20;
const retryDelayMs = 3000;

const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'ticketera',
  password: process.env.DB_PASSWORD || 'ticketera123',
  database: process.env.DB_DATABASE_NAME || 'ticketera_local',
};

async function waitForDbAndShouldSeed() {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const conn = await mysql.createConnection(dbConfig);
      const [tableRows] = await conn.query(
        "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'Cuentas'",
        [dbConfig.database],
      );

      if (!tableRows[0]?.count) {
        await conn.end();
        return true;
      }

      const [countRows] = await conn.query('SELECT COUNT(*) AS count FROM Cuentas');
      await conn.end();

      return Number(countRows[0]?.count || 0) === 0;
    } catch (error) {
      console.log(`DB no lista (intento ${attempt}/${maxRetries}): ${error.message}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      } else {
        throw error;
      }
    }
  }

  return false;
}

function runDemoSeeder() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['./seed/demoSeeder.js', '-d'], {
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Seeder terminó con código ${code}`));
      }
    });
  });
}

async function main() {
  const shouldSeed = await waitForDbAndShouldSeed();
  if (!shouldSeed) {
    console.log('Seeder omitido: la base local ya contiene datos.');
    process.exit(0);
  }

  console.log('Base local vacía detectada. Ejecutando demo seeder...');
  await runDemoSeeder();
  console.log('Seeder completado correctamente.');
}

main().catch((error) => {
  console.error('Error ejecutando seed-if-needed:', error);
  process.exit(1);
});
