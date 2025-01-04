import { DataTypes } from "sequelize";
import { nanoid } from "nanoid";
import db from "../config/db.js";

const casaMatriz = db.define('CasasMatrices', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => nanoid(12),
    },
    imagen: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    rut: {
        type: DataTypes.STRING,
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
    timestamps: false,
    name: 'CasasMatrices'
});

export default casaMatriz;