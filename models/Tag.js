import { DataTypes } from "sequelize";
import db from "../config/db.js";

const Tag = db.define(
  "Tags",
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
      type: DataTypes.STRING(7),
      allowNull: false,
      defaultValue: "#6366f1",
      validate: {
        is: /^#[0-9A-Fa-f]{6}$/,
      },
    },
    casaMatrizId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "Tags",
    timestamps: true,
  }
);

export default Tag;
