import { DataTypes } from "sequelize";
import db from "../config/db.js";

const levantamiento = db.define('Levantamientos', {
    // clientName: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // dateTime: {
    //     type: DataTypes.DATE,
    //     allowNull: false
    // },
    // problemType: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // problemDescription: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // responsible: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // additionalNotes: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // }

    clientName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    department: {
        type: DataTypes.STRING,
        allowNull: true
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    generalInfo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true
    },



    equipmentType: {
        type: DataTypes.STRING,
        allowNull: true
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
    assignedUser: {
        type: DataTypes.STRING,
        allowNull: true
    },
    processor: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ram: {
        type: DataTypes.STRING,
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


    // Extras
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
        type: DataTypes.DATE,
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
}, {
    timestamps: false
})

export default levantamiento