import { exit } from 'node:process'
import Clientes from './Cliente.js'
import Cuentas from './Cuenta.js'
import UsuariosAsignados from './UsuarioAsignado.js'
import Equipamientos from './Equipamiento.js'
import db from '../config/db.js'
import { ClienteModel, CuentaModel, EquipamientoModel, UsuarioAsignadoModel } from '../models/index.js'

const importarDatos = async () => {
    try {
        await db.authenticate();
        await db.sync();

        await CuentaModel.bulkCreate(Cuentas);
        await ClienteModel.bulkCreate(Clientes);
        await EquipamientoModel.bulkCreate(Equipamientos);
        await UsuarioAsignadoModel.bulkCreate(UsuariosAsignados);

        console.log('datos importados');
        exit();
    } catch (error) {
        console.log(error);
        exit(1);
    }
}

const eliminarDatos = async () => {
    try {
        await db.authenticate()
        await db.sync({ force: true })
        exit()
    } catch (error) {
        console.log(error)
        exit(1)
    }
}

if(process.argv[2] === "-i") {
    importarDatos()
}

if(process.argv[2] === "-e") {
    eliminarDatos()
}