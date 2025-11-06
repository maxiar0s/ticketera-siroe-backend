import { DataTypes } from "sequelize";
import db from "../config/db.js";

const VehiculoSalidaAdjunto = db.define(
  "VehiculoSalidaAdjuntos",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    vehiculoSalidaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    archivo: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nombreArchivo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    mimeType: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    tipo: {
      type: DataTypes.ENUM("general", "comprobante"),
      allowNull: false,
      defaultValue: "general",
    },
  },
  {
    tableName: "VehiculoSalidaAdjuntos",
    timestamps: true,
  }
);

export default VehiculoSalidaAdjunto;

