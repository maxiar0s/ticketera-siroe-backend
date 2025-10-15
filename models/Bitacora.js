import { DataTypes } from "sequelize";
import db from "../config/db.js";

const normalizarLista = (value) => {
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
        return normalizarLista(parsed);
      }
    } catch (_error) {
      // Ignorar, continuamos con el flujo estandar
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
};

const bitacora = db.define(
  "Bitacoras",
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
          // Continuamos al fallback
        }
        return normalizarLista(raw);
      },
      set(value) {
        const normalizado = normalizarLista(value);
        this.setDataValue("tecnicos", JSON.stringify(normalizado));
      },
    },
    fechaVisita: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    horaLlegada: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    horaSalida: {
      type: DataTypes.DATE,
      allowNull: false,
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
  },
  {
    tableName: "Bitacoras",
    timestamps: true,
  }
);

export default bitacora;
