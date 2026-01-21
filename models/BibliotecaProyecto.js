import { DataTypes } from "sequelize";
import db from "../config/db.js";

const BibliotecaProyecto = db.define(
  "BibliotecaProyectos",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    casaMatrizId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nombre: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    linkRepositorio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    envVariables: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    credenciales: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    instruccionesInstalacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    instruccionesProd: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    manualUsuario: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notasTecnicas: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tecnologias: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
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
    tableName: "BibliotecaProyectos",
    timestamps: true,
  },
);

export default BibliotecaProyecto;
