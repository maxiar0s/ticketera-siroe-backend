import { DataTypes } from "sequelize";
import db from "../config/db.js";

const equipamiento = db.define('Equipamientos', {
    equipmentType: {
        type: DataTypes.STRING,
        allowNull: true
    },
    brand: {
        type: DataTypes.STRING,
        allowNull: false
    },
    model: {
        type: DataTypes.STRING,
        allowNull: false
    },
    serialNumber: {
        type: DataTypes.STRING,
        allowNull: false
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
        allowNull: false
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
        allowNull: false
    },
    physicalState: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastMaintenance: {
        type: DataTypes.DATE,
        allowNull: true
    },
    currentIssues: {
        type: DataTypes.STRING,
        allowNull: true
    },


    // Campos Extras
    monitors: {
        type: DataTypes.STRING,
        allowNull: false
    },
    keyboard: {
        type: DataTypes.STRING,
        allowNull: false
    },
    mouse: {
        type: DataTypes.STRING,
        allowNull: false
    },
    otherPeripherals: {
        type: DataTypes.STRING,
        allowNull: false
    },
    antivirus: {
        type: DataTypes.STRING,
        allowNull: false
    },
    backupSoftware: {
        type: DataTypes.STRING,
        allowNull: false
    },
    lastBackup: {
        type: DataTypes.DATE,
        allowNull: false
    },
    securitySoftware: {
        type: DataTypes.STRING,
        allowNull: false
    },
    comments: {
        type: DataTypes.STRING,
        allowNull: false
    }
},{
    timestamps: false
});

export default equipamiento;