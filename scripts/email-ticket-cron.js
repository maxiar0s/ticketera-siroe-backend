import "dotenv/config";
import cron from "node-cron";

import { emailTicketConfig } from "../config/emailTicketConfig.js";
import EmailTicketProcessor from "../services/email/emailTicketProcessor.js";

const processor = new EmailTicketProcessor(emailTicketConfig);
const schedule =
  emailTicketConfig.cronExpression &&
  cron.validate(emailTicketConfig.cronExpression)
    ? emailTicketConfig.cronExpression
    : "*/5 * * * *";

const timezone = emailTicketConfig.timezone ?? "UTC";

const ejecutarProcesamiento = async () => {
  const inicio = new Date();
  console.log(
    `[EmailTicketCron] Inicio del ciclo ${inicio.toISOString()} (tz: ${timezone})`
  );
  try {
    const resultado = await processor.procesarBuzon();
    console.log(
      `[EmailTicketCron] Finalizado - procesados: ${resultado.processed}, exitosos: ${resultado.success}, errores: ${resultado.errors}`
    );
  } catch (error) {
    console.error(
      "[EmailTicketCron] Error durante la ejecución programada:",
      error
    );
  }
};

const iniciar = async () => {
  console.log(
    `[EmailTicketCron] Programación activa cada "${schedule}" (tz: ${timezone})`
  );

  const runNow = process.argv.includes("--now");
  if (runNow) {
    await ejecutarProcesamiento();
  }

  cron.schedule(
    schedule,
    () => {
      ejecutarProcesamiento();
    },
    {
      timezone,
    }
  );
};

iniciar();
