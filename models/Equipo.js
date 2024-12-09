import { DataTypes } from "sequelize";
import db from "../config/db.js";

const equipo = db.define('Equipos', {
    numeroSecuencial: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    codigoId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tipo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fechaIngreso: {
        type: DataTypes.DATEONLY,
    },
    departamento: {
        type: DataTypes.STRING,
        allowNull: false
    },
    usuario: {
        type: DataTypes.STRING,
        allowNull: true
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
    timestamps: false,
    hooks: {
        beforeCreate(sucursal) {
          const fecha = new Date();
          const dia = String(fecha.getDate()).padStart(2, '0');
          const mes = String(fecha.getMonth() + 1).padStart(2, '0');
          const anio = fecha.getFullYear();
          sucursal.fechaIngreso = `${dia}/${mes}/${anio}`;
        },
    },
});

export default equipo;