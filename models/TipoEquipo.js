import { DataTypes } from "sequelize";
import db from "../config/db.js";

const TipoEquipo = db.define('TipoEquipos', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    dict: {
        type: DataTypes.STRING,
        allowNull: false,
    }
}, {
    timestamps: false,
});

export default TipoEquipo;
