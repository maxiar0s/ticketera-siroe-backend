import { DataTypes } from "sequelize";
import db from "../config/db.js";

const metodosPago = [
  "Efectivo",
  "Tarjeta",
  "Copec Personas",
  "Copec Empresas",
];

const VehiculoSalida = db.define(
  "VehiculoSalidas",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    vehiculoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fechaHoraSalida: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fechaHoraLlegada: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    odometroSalida: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    odometroLlegada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    cargaCombustible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    metodoPago: {
      type: DataTypes.ENUM(...metodosPago),
      allowNull: true,
    },
    valorCarga: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    comentarios: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "VehiculoSalidas",
    timestamps: true,
  }
);

export { metodosPago };
export default VehiculoSalida;

