import db from "../config/db.js";
import { ensureTicketCreatorEmailColumn } from "./ensure-ticket-creator-email.js";

const run = async () => {
  try {
    await db.authenticate();
    await ensureTicketCreatorEmailColumn();
  } catch (error) {
    console.error("Error al agregar/backfillear creatorEmail:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();
