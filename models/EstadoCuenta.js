import { DataTypes } from 'sequelize';
import db from '../config/db.js';

const EstadoCuenta = db.define('EstadoCuentas', {
    name: {
        type: DataTypes.STRING,
        allowNull: true
    }
},{
    timestamps: false,
    name: 'EstadoCuentas',
});

export default EstadoCuenta;