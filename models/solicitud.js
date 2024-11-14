import { DataTypes } from "sequelize";
import db from "../config/db.js";

const solicitud = db.define('Solicitud', {
    clientName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    dateTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    problemType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    problemDescription: {
        type: DataTypes.STRING,
        allowNull: false
    },
    responsible: {
        type: DataTypes.STRING,
        allowNull: false
    },
    additionalNotes: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: false
})

export default solicitud