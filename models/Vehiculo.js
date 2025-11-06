import { DataTypes } from "sequelize";
import db from "../config/db.js";

const Vehiculo = db.define(
  "Vehiculos",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    patente: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },
    responsable: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    imagen: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    fechaUltimaMantencion: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fechaSiguienteMantencion: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    tableName: "Vehiculos",
    timestamps: true,
  }
);

export default Vehiculo;

