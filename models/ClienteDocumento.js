import { DataTypes } from "sequelize";
import db from "../config/db.js";

export const CLIENTE_DOCUMENTO_TIPOS = ["factura", "contrato", "otros"];

const ClienteDocumento = db.define(
  "ClienteDocumentos",
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
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [CLIENTE_DOCUMENTO_TIPOS],
      },
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    size: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    subidoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "ClienteDocumentos",
    timestamps: true,
  }
);

export default ClienteDocumento;
