import "dotenv/config";

import { emailTicketConfig } from "../config/emailTicketConfig.js";
import EmailTicketProcessor from "../services/email/emailTicketProcessor.js";

const runProcessor = async (processor) => {
  try {
    const result = await processor.procesarBuzon();
    console.log(
      `[EmailTicketProcessor] Correo procesado. Total: ${result.processed}, exitosos: ${result.success}, errores: ${result.errors}`
    );
  } catch (error) {
    console.error("[EmailTicketProcessor] Error general al procesar buzón:", error);
  }
};

const main = async () => {
  const processor = new EmailTicketProcessor(emailTicketConfig);
  const watchMode = process.argv.includes("--watch");
  const interval =
    typeof emailTicketConfig.pollIntervalMs === "number" &&
    emailTicketConfig.pollIntervalMs > 0
      ? emailTicketConfig.pollIntervalMs
      : 60000;

  if (watchMode) {
    console.log(
      `[EmailTicketProcessor] Modo monitor activado. Intervalo: ${interval}ms`
    );
    await runProcessor(processor);
    setInterval(() => {
      runProcessor(processor);
    }, interval);
  } else {
    await runProcessor(processor);
    // Garantizar que las conexiones pendientes se cierren antes de finalizar
    setTimeout(() => process.exit(0), 250);
  }
};

main();
