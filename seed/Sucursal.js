import { CasaMatrizModel } from '../models/index.js';

const casaMatriz = await CasaMatrizModel.findOne();

const Sucursales = [
    {
        id: nanoid(12),
        estado: 1,
        encargadoSucursal: 'Roberto Osses',
        correoSucursal: 'rosses@siroe.cl',
        telefonoSucursal: '92812422',
        sucursal: 'Sucursal Plaza de Maipu',
        fechaIngreso: '2024/05/02',
        direccion: 'Plaza de Maipu',
        casaMatriId: casaMatriz.id
    }
]

export default Sucursales;