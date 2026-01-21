import { BibliotecaProyectoModel } from "./models/index.js";
import process from "process";

console.log("Verificando columna credenciales...");

try {
  const tableInfo = await BibliotecaProyectoModel.describe();
  if (tableInfo.credenciales) {
    console.log('✅ La columna "credenciales" EXISTE.');
    console.log("Detalles:", tableInfo.credenciales);
    process.exit(0);
  } else {
    console.error('❌ La columna "credenciales" NO EXISTE.');
    process.exit(1);
  }
} catch (error) {
  console.error("❌ Error al describir tabla:", error);
  process.exit(1);
}
