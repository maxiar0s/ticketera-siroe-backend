import { DataTypes } from "sequelize";
import db from "../config/db.js";

const BibliotecaCategoria = db.define(
  "BibliotecaCategorias",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    color: {
      type: DataTypes.STRING(25),
      allowNull: false,
      defaultValue: "#6366f1",
    },
    columnas: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [
        {
          id: "general",
          nombre: "General",
          tipoTexto: "normal",
          permiteAdjuntos: false,
          orden: 0,
        },
        {
          id: "notas",
          nombre: "Notas",
          tipoTexto: "normal",
          permiteAdjuntos: false,
          orden: 1,
        },
        {
          id: "adjuntos",
          nombre: "Adjuntos Generales",
          tipoTexto: null,
          permiteAdjuntos: true,
          orden: 2,
        },
      ],
    },
    creadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "BibliotecaCategorias",
    timestamps: true,
  },
);

export default BibliotecaCategoria;
