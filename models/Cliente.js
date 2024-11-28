import { DataTypes } from "sequelize";
import db from "../config/db.js";

const cliente = db.define('Clientes', {
    // clientName: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // department: {
    //     type: DataTypes.STRING,
    //     allowNull: true
    // },
    // phone: {
    //     type: DataTypes.STRING,
    //     allowNull: true
    // },
    // generalInfo: {
    //     type: DataTypes.STRING,
    //     allowNull: true
    // },
    // email: {
    //     type: DataTypes.STRING,
    //     allowNull: true
    // },
    // location: {
    //     type: DataTypes.STRING,
    //     allowNull: true
    // },
        id: {
            type: DataTypes.UUIDV4,
            allowNull: false,
            primaryKey: true
        },
        rut: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        razonSocial: {
            type: DataTypes.STRING,
            allowNull: false
        },
        encargadoGeneral: {
            type: DataTypes.STRING,
            allowNull: false
        },
        correo: {
            type: DataTypes.STRING,
            allowNull: false
        },
        telefonoEncargado: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
}, {
    timestamps: false
});

export default cliente;