import { DataTypes } from 'sequelize';
import db from "../config/db.js";

const Campo = db.define('Campo', {
    name: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    label: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    type: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    placeholder: { 
        type: DataTypes.STRING 
    },
    required: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false 
    },
    presetOptions: {
        type: DataTypes.JSON,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('presetOptions');
            return Array.isArray(rawValue) ? rawValue : [];
        },
        set(value) {
            this.setDataValue('presetOptions', Array.isArray(value) ? value : []);
        },
    },
    standards: {
        type: DataTypes.JSON,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('standards');
            return Array.isArray(rawValue) ? rawValue : [];
        },
        set(value) {
            this.setDataValue('standards', Array.isArray(value) ? value : []);
        },
    },
}, {
    timestamps: false,  
}); 


export default Campo;
