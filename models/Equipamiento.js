import { DataTypes } from "sequelize";
import db from "../config/db.js";

const equipamiento = db.define('Equipamientos', {
    equipmentType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    brand: {
        type: DataTypes.STRING,
        allowNull: true
    },
    model: {
        type: DataTypes.STRING,
        allowNull: true
    },
    serialNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    processor: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ram: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    storage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    os: {
        type: DataTypes.STRING,
        allowNull: true
    },
    officeSuite: {
        type: DataTypes.STRING,
        allowNull: true
    },
    softwareLicenses: {
        type: DataTypes.STRING,
        allowNull: true
    },
    physicalState: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastMaintenance: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    currentIssues: {
        type: DataTypes.STRING,
        allowNull: true
    },


    // Campos Extras
    monitors: {
        type: DataTypes.STRING,
        allowNull: true
    },
    keyboard: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mouse: {
        type: DataTypes.STRING,
        allowNull: true
    },
    otherPeripherals: {
        type: DataTypes.STRING,
        allowNull: true
    },
    antivirus: {
        type: DataTypes.STRING,
        allowNull: true
    },
    backupSoftware: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastBackup: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    securitySoftware: {
        type: DataTypes.STRING,
        allowNull: true
    },
    comments: {
        type: DataTypes.STRING,
        allowNull: true
    }
},{
    timestamps: false
});

export default equipamiento;