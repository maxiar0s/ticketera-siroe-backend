import { DataTypes } from 'sequelize';
import db from '../config/db.js';

const Observacion = db.define('Observaciones', {
    text: {
        type: DataTypes.STRING,
        allowNull: true
    },
    fechaIngreso: {
        type: DataTypes.DATEONLY,
    },
},{
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

export default Observacion;