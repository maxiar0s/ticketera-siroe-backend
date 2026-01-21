import { BibliotecaProyectoModel } from "./models/index.js";
import process from "process";

console.log("Sincronizando tabla BibliotecaProyecto con credenciales...");

try {
  await BibliotecaProyectoModel.sync({ alter: true });
  console.log("✅ Tabla BibliotecaProyecto sincronizada correctamente.");
  process.exit(0);
} catch (error) {
  console.error("❌ Error al sincronizar tabla:", error);
  console.error(error); // Imprimir detalle completo
  process.exit(1);
}
