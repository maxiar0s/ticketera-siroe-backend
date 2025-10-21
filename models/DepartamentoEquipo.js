import { DataTypes } from "sequelize";
import db from "../config/db.js";

const departamentoEquipo = db.define(
  "DepartamentosEquipo",
  {
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 120],
      },
    },
  },
  {
    tableName: "DepartamentosEquipo",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["name"],
        name: "DepartamentosEquipo_name_unique",
      },
    ],
  }
);

export default departamentoEquipo;
