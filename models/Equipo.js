import { DataTypes } from "sequelize";
import db from "../config/db.js";

const equipo = db.define('Equipos', {
    tipo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    marca: {
        type: DataTypes.STRING,
        allowNull: true
    },
    modelo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    numeroSerie: {
        type: DataTypes.STRING,
        allowNull: true
    },
    procesador: {
        type: DataTypes.STRING,
        allowNull: true
    },
    velocidadProcesador: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ram: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    tipoAlmacenamiento: {
        type: DataTypes.STRING,
        allowNull: true
    },
    cantidadAlmacenamiento: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    sistemaOperativo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ofimatica: {
        type: DataTypes.STRING,
        allowNull: true
    },
    antivirus: {
        type: DataTypes.STRING,
        allowNull: true
    },
    observaciones: {
        type: DataTypes.STRING,
        allowNull: true
    }
},{
    timestamps: false
});

export default equipo;