import { DataTypes } from "sequelize";
import db from "../config/db.js";

const normalizeList = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => `${item}`.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return normalizeList(parsed);
      }
    } catch (_error) {
      // Ignorar parsing fallido, usamos el fallback
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
};

const ticket = db.define(
  "Tickets",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    titulo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tecnicos: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "[]",
      get() {
        const raw = this.getDataValue("tecnicos");
        if (!raw) {
          return [];
        }
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch (_error) {
          // fallback
        }
        return normalizeList(raw);
      },
      set(value) {
        const normalized = normalizeList(value);
        this.setDataValue("tecnicos", JSON.stringify(normalized));
      },
    },
    fechaVisita: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    horaLlegada: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    horaSalida: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    casaMatrizId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sucursalId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    creadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    adjuntos: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "[]",
      get() {
        const raw = this.getDataValue("adjuntos");
        return normalizeList(raw);
      },
      set(value) {
        if (!value) {
          this.setDataValue("adjuntos", JSON.stringify([]));
        } else if (Array.isArray(value)) {
          this.setDataValue("adjuntos", JSON.stringify(value));
        } else if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              this.setDataValue("adjuntos", JSON.stringify(parsed));
              return;
            }
          } catch (_err) {}
          this.setDataValue("adjuntos", JSON.stringify([value]));
        } else {
          this.setDataValue("adjuntos", JSON.stringify([]));
        }
      },
    },
    adjuntosTermino: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "[]",
      get() {
        const raw = this.getDataValue("adjuntosTermino");
        return normalizeList(raw);
      },
      set(value) {
        if (!value) {
          this.setDataValue("adjuntosTermino", JSON.stringify([]));
        } else if (Array.isArray(value)) {
          this.setDataValue("adjuntosTermino", JSON.stringify(value));
        } else if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              this.setDataValue("adjuntosTermino", JSON.stringify(parsed));
              return;
            }
          } catch (_err) {}
          this.setDataValue("adjuntosTermino", JSON.stringify([value]));
        } else {
          this.setDataValue("adjuntosTermino", JSON.stringify([]));
        }
      },
    },
    isEmergencia: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    estadoTicket: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Nuevo",
    },
    fechaTermino: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    detalleTermino: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    proyectoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "Tickets",
    timestamps: true,
  }
);

export default ticket;
