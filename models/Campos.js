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
}, {
    timestamps: false,  
}); 


export default Campo;