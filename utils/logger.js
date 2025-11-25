import { LogSistemaModel } from "../models/index.js";

const registrarLog = async (
  usuarioId,
  accion,
  metodo,
  ruta,
  ip,
  detalles = null
) => {
  try {
    await LogSistemaModel.create({
      usuarioId,
      accion,
      metodo,
      ruta,
      ip,
      detalles:
        typeof detalles === "object" ? JSON.stringify(detalles) : detalles,
    });
  } catch (error) {
    console.error("Error al registrar log:", error);
  }
};

export default registrarLog;
