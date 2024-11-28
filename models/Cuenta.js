import { DataTypes } from "sequelize";
import db from "../config/db.js";

const cuenta = db.define('Cuentas', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    telefono: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    token: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: false,  
});

export default cuenta;