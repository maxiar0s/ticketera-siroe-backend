import { DataTypes } from "sequelize";
import db from "../config/db.js";

const estadoSucursal = db.define('EstadoSucursal', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: false
});

export default estadoSucursal;
