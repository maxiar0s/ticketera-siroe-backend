import { DataTypes } from "sequelize";
import db from "../config/db.js";

const ProyectoAdjunto = db.define(
  "ProyectoAdjuntos",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    proyectoId: {
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
    subidoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "ProyectoAdjuntos",
    timestamps: true,
  }
);

export default ProyectoAdjunto;

