import { DataTypes } from "sequelize";
import db from "../config/db.js";

const parseMetadata = (value) => {
  if (!value) {
    return {};
  }
  if (typeof value === "object") {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }
  return {};
};

const Notificacion = db.define(
  "Notificaciones",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    cuentaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    titulo: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    referenciaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    referenciaTipo: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    leida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "{}",
      get() {
        const raw = this.getDataValue("metadata");
        return parseMetadata(raw);
      },
      set(value) {
        const normalizado = parseMetadata(value);
        this.setDataValue("metadata", JSON.stringify(normalizado));
      },
    },
  },
  {
    tableName: "Notificaciones",
    timestamps: true,
    updatedAt: "updatedAt",
    createdAt: "createdAt",
  }
);

export default Notificacion;
