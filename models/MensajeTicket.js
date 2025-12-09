import { DataTypes } from "sequelize";
import db from "../config/db.js";

/**
 * Modelo para mensajes del chat de tickets.
 * Almacena la comunicación entre clientes y técnicos/administradores.
 */
const MensajeTicket = db.define(
  "MensajesTicket",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cuentaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    adjuntos: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "[]",
      get() {
        const raw = this.getDataValue("adjuntos");
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      },
      set(value) {
        if (!value) {
          this.setDataValue("adjuntos", "[]");
        } else if (Array.isArray(value)) {
          this.setDataValue("adjuntos", JSON.stringify(value));
        } else if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              this.setDataValue("adjuntos", value);
              return;
            }
          } catch (e) {
            // ignore
          }
          this.setDataValue("adjuntos", JSON.stringify([value]));
        } else {
          this.setDataValue("adjuntos", "[]");
        }
      },
    },
    leido: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "MensajesTicket",
    timestamps: true,
  }
);

export default MensajeTicket;
