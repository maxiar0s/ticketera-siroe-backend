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
        allowNull: true,
    },
    razonSocial: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    encargadoGeneral: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    correo: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    telefonoEncargado: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    banco: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    tipoCuentaBancaria: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    numeroCuentaBancaria: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    titularCuenta: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    rutTitularCuenta: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    correoNotificacionPago: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    visitasMensuales: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
    },
    visitasEmergenciaAnuales: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
    },
    servicios: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    fechaIngreso: {
        type: DataTypes.DATEONLY,
    },
    esLead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
