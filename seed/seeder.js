import { exit } from 'node:process'
import Clientes from './CasaMatriz.js'
import Cuentas from './Cuenta.js'
import UsuariosAsignados from './UsuarioAsignado.js'
import Equipamientos from './Equipamiento.js'
import TipoCuentas from './TipoCuenta.js'
import db from '../config/db.js'
import { ClienteModel, TipoCuentaModel, CuentaModel, EquipoModel } from '../models/index.js'

const importarDatos = async () => {
    try {
        await db.authenticate();
        await db.sync();
        await TipoCuentaModel.bulkCreate(TipoCuentas);
        await CuentaModel.bulkCreate(Cuentas);
        await ClienteModel.bulkCreate(Clientes);
        await EquipoModel.bulkCreate(Equipamientos);
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