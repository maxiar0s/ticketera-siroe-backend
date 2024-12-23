import { DataTypes } from "sequelize";
import db from "../config/db.js";

const tipoCuenta = db.define('TipoCuenta', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: false,
});

export default tipoCuenta;