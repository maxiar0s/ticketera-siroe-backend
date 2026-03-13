import { DataTypes } from "sequelize";
import db from "../config/db.js";

const cuenta = db.define('Cuentas', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    telefono: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    token: {
        type: DataTypes.STRING,
        allowNull: true
    },
    modulosAcceso: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('modulosAcceso');

            if (!rawValue) {
                return null;
            }

            if (typeof rawValue === 'object') {
                return rawValue;
            }

            try {
                return JSON.parse(rawValue);
            } catch (_error) {
                return null;
            }
        },
        set(value) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                this.setDataValue('modulosAcceso', null);
                return;
            }

            this.setDataValue('modulosAcceso', JSON.stringify(value));
        }
    },
    esTecnico: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    ocupacion: {
        type: DataTypes.STRING,
        allowNull: true
    },
    haveTickets: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    timestamps: false,
    scopes: {
        eliminarCampos: {
            attributes: {
                exclude: ['password', 'token']
            }
        }
    }
});

export default cuenta;
