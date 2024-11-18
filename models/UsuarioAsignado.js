import { DataTypes } from "sequelize";
import db from "../config/db.js";

const usuarioAsignado = db.define('UsuariosAsignados', {   
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
},{
    timestamps: false
});

export default usuarioAsignado;