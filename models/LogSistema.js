import { DataTypes } from "sequelize";
import db from "../config/db.js";

const LogSistema = db.define(
  "LogSistemas",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    accion: {
      type: DataTypes.STRING, // LOGIN, LOGOUT, CONSULTA, ERROR
      allowNull: false,
    },
    metodo: {
      type: DataTypes.STRING, // GET, POST, etc.
      allowNull: true,
    },
    ruta: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    detalles: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fecha: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "LogSistemas",
    timestamps: false, // We use our own 'fecha' field
  }
);

export default LogSistema;
