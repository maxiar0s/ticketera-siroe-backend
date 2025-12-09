import { DataTypes } from "sequelize";
import db from "../config/db.js";

/**
 * Modelo para registrar actividad/movimientos del ticket.
 * Almacena cambios de estado, prioridad, transferencias, etc.
 */
const ActividadTicket = db.define(
  "ActividadesTicket",
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
    tipo: {
      type: DataTypes.ENUM(
        "estado",
        "prioridad",
        "transferencia",
        "asignacion",
        "creacion",
        "comentario",
        "adjunto"
      ),
      allowNull: false,
    },
    valorAnterior: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    valorNuevo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "{}",
      get() {
        const raw = this.getDataValue("metadata");
        if (!raw) return {};
        try {
          const parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch (e) {
          return {};
        }
      },
      set(value) {
        if (!value) {
          this.setDataValue("metadata", "{}");
        } else if (typeof value === "object") {
          this.setDataValue("metadata", JSON.stringify(value));
        } else if (typeof value === "string") {
          this.setDataValue("metadata", value);
        } else {
          this.setDataValue("metadata", "{}");
        }
      },
    },
  },
  {
    tableName: "ActividadesTicket",
    timestamps: true,
    updatedAt: false, // Solo necesitamos createdAt
  }
);

export default ActividadTicket;
