import { DataTypes } from "sequelize";
import db from "../config/db.js";

const estadoEquipo = db.define('EstadoEquipos', {
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

export default estadoEquipo;