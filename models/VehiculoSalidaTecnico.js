import { DataTypes } from "sequelize";
import db from "../config/db.js";

const VehiculoSalidaTecnico = db.define(
  "VehiculoSalidaTecnicos",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    vehiculoSalidaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tecnicoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "VehiculoSalidaTecnicos",
    timestamps: false,
  }
);

export default VehiculoSalidaTecnico;

