import cron from "node-cron";
import { Op } from "sequelize";
import LogSistema from "../models/LogSistema.js";

/**
 * Inicializa las tareas programadas del sistema.
 */
export const initCronJobs = () => {
  console.log("[CronService] Inicializando tareas programadas...");

  // Tarea de limpieza de logs: Se ejecuta todos los domingos a la medianoche (00:00)
  // Cron expression: "0 0 * * 0"
  cron.schedule("0 0 * * 0", async () => {
    console.log("[CronService] Iniciando limpieza semanal de logs...");
    try {
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - 7); // Logs más antiguos de 7 días

      const eliminados = await LogSistema.destroy({
        where: {
          fecha: {
            [Op.lt]: fechaLimite,
          },
        },
      });

      console.log(
        `[CronService] Limpieza completada. Se eliminaron ${eliminados} registros de logs antiguos.`,
      );
    } catch (error) {
      console.error("[CronService] Error durante la limpieza de logs:", error);
    }
  });

  console.log(
    "[CronService] Tarea de limpieza de logs programada (Semanal - Domingo 00:00).",
  );
};
