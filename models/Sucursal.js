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
    fechaIngreso: {
        type: DataTypes.DATEONLY,
        // allowNull: false
    },
    direccion: {
        type: DataTypes.STRING,
        allowNull: false
    },
    habilitado: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    }
}, {
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

export default sucursal;