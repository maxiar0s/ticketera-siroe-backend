import { DataTypes } from "sequelize";
import { nanoid } from "nanoid";
import db from "../config/db.js";

const sucursal = db.define('Sucursales', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => nanoid(12),
    },
    estado: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
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
    },
    direccion: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    timestamps: false,
    hooks: {
        beforeCreate(sucursal) {
          const fecha = new Date();
          const dia = String(fecha.getDate()).padStart(2, '0');
          const mes = String(fecha.getMonth() + 1).padStart(2, '0');
          const anio = fecha.getFullYear();
          sucursal.fechaIngreso = `${anio}-${mes}-${dia}`;
        },
    },
});

export default sucursal;