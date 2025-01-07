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
    },
    fechaIngreso: {
        type: DataTypes.DATEONLY,
    },
}, {
    timestamps: false,
    name: 'CasasMatrices',
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

export default casaMatriz;