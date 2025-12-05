import db from "../config/db.js";
import { TicketModel } from "../models/index.js";

const syncTickets = async () => {
  try {
    console.log("Sincronizando modelo Tickets...");
    await TicketModel.sync({ alter: true });
    console.log("Modelo Tickets sincronizado correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("Error al sincronizar Tickets:", error);
    process.exit(1);
  }
};

syncTickets();
