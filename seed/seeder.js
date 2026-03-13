import { exit } from 'node:process';
import { nanoid } from "nanoid";

import { 
    CuentaModel, 
    TipoCuentaModel, 
    EstadoCuentaModel,

    CasaMatrizModel,
    SucursalModel,

    EquipoModel,
    TipoEquipoModel,
    TipoEquipoCampoModel,
    CampoModel,
    
    //?estado de equipos
    EstadoEquipoModel,
    EstadoSucursalModel,
} from '../models/index.js';

import Cuentas from './Cuenta.js';
import TipoCuentas from './TipoCuenta.js';

import CasasMatrices from './CasaMatriz.js';
// import Sucursal from './Sucursal.js';

import TipoEquipo from './TipoEquipo.js';
import TipoEquipoCampo from './TipoEquipoCampo.js';
import Campos from './Campo.js';

//?estado de equipos
import EstadosEquipo from './EstadoEquipo.js';
//?estado sucursal
import EstadosSucursal from './EstadoSucursal.js';


import db from '../config/db.js';
import estadoCuenta from './EstadoCuenta.js';
import { ensureTicketCreatorEmailColumn } from '../scripts/ensure-ticket-creator-email.js';
import { ensureTicketFuenteEnum } from '../scripts/ensure-ticket-fuente-enum.js';
import { ensureInventarioModule } from '../scripts/add-inventario-module.js';

const importarDatos = async () => {
    try {
        await db.authenticate();
        await db.sync();
        await ensureTicketFuenteEnum();
        await ensureTicketCreatorEmailColumn({ runBackfill: false });
        await ensureInventarioModule();

        await Promise.all([
            EstadoCuentaModel.bulkCreate(estadoCuenta),
            TipoCuentaModel.bulkCreate(TipoCuentas),
            CasaMatrizModel.bulkCreate(CasasMatrices),
            EstadoEquipoModel.bulkCreate(EstadosEquipo),
            EstadoSucursalModel.bulkCreate(EstadosSucursal),
        ])

        const casaMatriz = await CasaMatrizModel.findAll();

        const idCasaMatriz = casaMatriz[0].dataValues.id;

        const Sucursales = [
            {
                id: nanoid(12),
                estado: 1,
                encargadoSucursal: 'Roberto Osses',
                correoSucursal: 'rosses@siroe.cl',
                telefonoSucursal: '92812422',
                sucursal: 'Sucursal Plaza de Maipu',
                fechaIngreso: new Date('2024/05/02'),
                direccion: 'Plaza de Maipu',
                casaMatrizId: idCasaMatriz,
            }
        ]
        
        await Promise.all([
            CuentaModel.bulkCreate(Cuentas),
            CampoModel.bulkCreate(Campos),
            SucursalModel.bulkCreate(Sucursales),
            TipoEquipoModel.bulkCreate(TipoEquipo),
        ])
        await TipoEquipoCampoModel.bulkCreate(TipoEquipoCampo);
        

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
