import { DataTypes } from "sequelize";
import db from "../config/db.js";

const EstadoInventario = db.define(
  "EstadoInventarios",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "EstadoInventarios",
    timestamps: false,
  }
);

export default EstadoInventario;
