import db from '../config/db.js';

const TipoEquipoCampo = db.define('TipoEquipoCampo', {
}, {
    timestamps: false,
});

export default TipoEquipoCampo;
