import { DataTypes } from "sequelize";
import db from "../config/db.js";

const usuario = db.define('Usuario', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: false,
    
})

export default usuario