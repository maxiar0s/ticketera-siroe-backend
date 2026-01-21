import { DataTypes } from "sequelize";
import db from "../config/db.js";

const BibliotecaAdjunto = db.define(
  "BibliotecaAdjuntos",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    bibliotecaProyectoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    archivo: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    nombreArchivo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    seccion: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    subidoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "BibliotecaAdjuntos",
    timestamps: true,
  },
);

export default BibliotecaAdjunto;
