import { DataTypes } from "sequelize";
import db from "../config/db.js";

const CuentaCasaMatriz = db.define(
  "CuentasCasasMatrices",
  {
    cuentaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Cuentas",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    casaMatrizId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "CasasMatrices",
        key: "id",
      },
      onDelete: "CASCADE",
    },
  },
  {
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["cuentaId", "casaMatrizId"],
      },
    ],
  }
);

export default CuentaCasaMatriz;
