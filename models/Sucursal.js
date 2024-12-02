import { DataTypes } from "sequelize";
import db from "../config/db.js";

const sucursal = db.define('Sucursales', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true
    },
    // razonSocial: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // rut: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // idCliente: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // // Datos encargado general
    // encargadoGeneral: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // correoEncargado: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // telefonoEncargado: {
    //     type: DataTypes.INTEGER,
    //     allowNull: false
    // },
    // Datos encargado sucursal
    encargadoSucursal: {
        type: DataTypes.STRING,
        allowNull: false
    },
    correoSucursal: {
        type: DataTypes.STRING,
        allowNull: false
    },
    telefonoSucursal: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    sucursal: {
        type: DataTypes.STRING,
        allowNull: false
    },
    direccion: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: false
});

export default sucursal;