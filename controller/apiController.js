import jwt from "jsonwebtoken";
import bcrypt from 'bcrypt';
import { col, fn } from "sequelize";

import { CampoModel, CasaMatrizModel, CuentaModel, EquipoModel, ObservacionModel, SucursalModel, TipoEquipoCampoModel, TipoEquipoModel } from "../models/index.js";


const login = async (req, res) => {
    const { email, password } = req.body;

    const user = await CuentaModel.findOne({ where: { email }});

    if(!user) return;

    const matchPassword = await bcrypt.compare(password, user.password);
    if(!matchPassword) return;

    const userData = {
        id: user.id,
        name: user.name,
        telefono: user.telefono,
        email: user.email
    };

    const token = jwt.sign({ userData }, 'Secret_S1r03_S0p0rt3_Password');
    return res.json({token});
}

const postCuenta = async (req, res) => {
    const { name, telefono, email, password, tipoCuenta } = req.body;

    const hashed_password = await bcrypt.hash(password, 10);

    const cuenta = await CuentaModel.create({
        name,
        telefono,
        email,
        tipoCuenta,
        password: hashed_password,
    });

    return res.json({ resp: 'Usuario creado exitosamente'});
}

const postModificarCuenta = async (req, res) => {
    const { id } = req.params;

    if(!id) {
        return res.json({ resp: 'Error al intentar modificar cuenta' });
    }

    const cuenta = await CuentaModel.findByPk(id);

    if(!cuenta) {
        return res.json({ resp: 'Cuenta no encontrado, intente nuevamente' });
    }

    const { name,
        telefono,
        email,
        password } = req.body;

    const hashed_password = await bcrypt.hash(password, 10);

    cuenta.set({
        name,
        telefono,
        email,
        password: hashed_password
    })
    cuenta.save();

    return res.json({ resp: 'Cuenta modificado correctamente' });
}

const postEliminarCuenta = async (req, res) => {
    const { id } = req.params;
    if(!id) {
        return res.json({ resp: 'Error al intentar eliminar cuenta' });
    }

    const cuenta = await CuentaModel.findByPk(id,{
        include: [
            { model: CuentaModel },
            { model: EquipoModel,
                include: [
                    { model: UsuarioAsignadoModel }
                ]
             }
        ]
    });

    if(!cliente) {
        return res.json({ resp: 'Cliente no encontrado, intente nuevamente' });
    }

    for (const equipamiento of cliente.Equipamientos) {
        await equipamiento.setUsuariosAsignados([]); 
      
        for (const usuario of equipamiento.UsuariosAsignados) {
          await usuario.destroy();
        }
      
        await equipamiento.destroy();
      }
      await cliente.destroy();

    return res.json({ resp: 'Cliente eliminado correctamente' });
}

const postCliente = async (req, res) => {
    // TODO realizar luego de implementar JWT
    const { rut,
        razonSocial,
        encargadoGeneral,
        correo,
        telefonoEncargado } = req.body;

    const nuevoCliente = await CasaMatrizModel.create({
        rut,
        razonSocial,
        encargadoGeneral,
        correo,
        telefonoEncargado
    });

    res.json({ resp: 'Cliente creado satisfactoriamente.', id: nuevoCliente.id });
}

const postModificarCliente = async (req, res) => {
    const { id } = req.params;

    if(!id) {
        return res.json({ resp: 'Error al intentar modificar cliente' });
    }

    const cliente = await CasaMatrizModel.findByPk(id);

    if(!cliente) {
        return res.json({ resp: 'Cliente no encontrado, intente nuevamente' });
    }

    const { rut,
        razonSocial,
        encargadoGeneral,
        correo,
        telefonoEncargado } = req.body;

    cliente.set({
        rut,
        razonSocial,
        encargadoGeneral,
        correo,
        telefonoEncargado
    })
    cliente.save();

    return res.json({ resp: 'Cliente modificado correctamente' });
}

const postEliminarCliente = async (req, res) => {
    const { id } = req.params;
    if(!id) {
        return res.json({ resp: 'Error al intentar eliminar cliente' });
    }

    const cliente = await CasaMatrizModel.findByPk(id,{
        include: [
            { model: CuentaModel },
            { model: EquipoModel,
                include: [
                    { model: UsuarioAsignadoModel }
                ]
             }
        ]
    });

    if(!cliente) {
        return res.json({ resp: 'Cliente no encontrado, intente nuevamente' });
    }

    for (const equipamiento of cliente.Equipamientos) {
        await equipamiento.setUsuariosAsignados([]); 
      
        for (const usuario of equipamiento.UsuariosAsignados) {
          await usuario.destroy();
        }
      
        await equipamiento.destroy();
      }
      await cliente.destroy();

    return res.json({ resp: 'Cliente eliminado correctamente' });
}

const postSucursal = async (req, res) => {
    const {
        encargadoSucursal,
        correoSucursal,
        telefonoSucursal,
        sucursal,
        direccion,
        casaMatrizId } = req.body;

    const nuevaSucursal = await SucursalModel.create({
        encargadoSucursal,
        correoSucursal,
        estado: 1,
        telefonoSucursal,
        sucursal,
        direccion,
        casaMatrizId
    });

    res.json({ resp: 'Sucursal creado satisfactoriamente.', id: nuevaSucursal.id });
}

const postModificarSucursal = (req, res) => {

}
const postEliminarSucursal = (req, res) => {

}

const postEquipo = async (req, res) => {
    const { clienteId = null, sucursalId = null } = req.body;

    if(!clienteId && !sucursalId) {
        return res.json({error: 'error'});
    }
    
    let equipo;
    if(sucursalId) {
        equipo = await EquipoModel.findOne({
            where: { sucursalId },
            order: [['numeroSecuencial', 'DESC']],
        });
    }
    else {
        equipo = await EquipoModel.findOne({
            where: { clienteId },
            order: [['numeroSecuencial', 'DESC']],
        });
    }

    const maxNumero = equipo ? equipo.numeroSecuencial : 0;
    const nextNumero = maxNumero + 1;
    
    const { departamento, tipoEquipoId } = req.body;
    // const diccionarioEquipos = {
    //     "Televisor": "TV",
    //     "Celular": "CL",
    //     "Notebook": "NT",
    //     "Data Show": "DS",
    //     "Tablet": "TB",
    //     "Pizarra interactiva": "PI",
    //     "Sistema de audio": "SA",
    //     "Aire acondicionado": "AA",
    //     "All in one": "AO",
    //     "Impresora": "IP"
    // };

    const tipoEquipo = await TipoEquipoModel.findOne({
        where: {
            id: tipoEquipoId
        }
    });
    
    // const normalizarLlave = (tipo) => tipo.trim().toLowerCase();
    // const buscarEquipo = (tipo) => {
    //     const claveNormalizada = Object.keys(diccionarioEquipos).find(
    //         (key) => key.toLowerCase() === normalizarLlave(tipo)
    //     );
    //     return claveNormalizada ? diccionarioEquipos[claveNormalizada] : undefined;
    // };

    // const tipoEquipo = buscarEquipo(tipo);

    const deptCode = departamento.substring(0, 4).toUpperCase();
    const numeroPadded = nextNumero.toString().padStart(3, '0');
    const codigoId = `SI${deptCode}${tipoEquipo.dict}${numeroPadded}`;

    const {
        marca = null,
        modelo = null,
        numeroSerie = null,
        procesador = null,
        velocidadProcesador = null,
        ram = null,
        tipoAlmacenamiento = null,
        cantidadAlmacenamiento = null,
        sistemaOperativo = null,
        ofimatica = null,
        antivirus = null } = req.body;
    
    await EquipoModel.create({
        numeroSecuencial: nextNumero,
        clienteId,
        sucursalId,
        estado: 1,
        marca,
        modelo,
        codigoId,
        departamento,
        numeroSerie,
        procesador,
        velocidadProcesador,
        ram,
        tipoAlmacenamiento,
        cantidadAlmacenamiento,
        sistemaOperativo,
        ofimatica,
        antivirus,
        tipoEquipoId: tipoEquipo.id
    });
    res.json({ resp: `Equipo creado satisfactoriamente.`});
}

const postObservacion = async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;

    const observacion = await ObservacionModel.create({
        text,
        equipoId: id
    });

    return res.json(observacion);
}

const postModificarEquipo = async (req, res) => {
    const { id } = req.params;
    
    if(!id) {
        return res.json({ resp: 'Error al intentar modificar el equipo' });
    }

    const equipo = await EquipoModel.findByPk(id);

    if(!equipo) {
        return res.json({ resp: 'Equipo no encontrado, intente nuevamente' });
    }

    const {
        marca,
        modelo,
        numeroSerie,
        procesador,
        velocidadProcesador,
        ram,
        tipoAlmacenamiento,
        cantidadAlmacenamiento,
        sistemaOperativo,
        ofimatica,
        antivirus,
        } = req.body;
    console.log(req.uploadedFile);
    if(req.uploadedFile) {
        const imagenName = req.uploadedFile

        equipo.set({
            marca,
            modelo,
            imagen: imagenName,
            numeroSerie,
            procesador,
            velocidadProcesador,
            ram,
            tipoAlmacenamiento,
            cantidadAlmacenamiento,
            sistemaOperativo,
            ofimatica,
            antivirus
        });
    }
    
    equipo.set({
        marca,
        modelo,
        numeroSerie,
        procesador,
        velocidadProcesador,
        ram,
        tipoAlmacenamiento,
        cantidadAlmacenamiento,
        sistemaOperativo,
        ofimatica,
        antivirus
    });

    equipo.save();

    return res.json({ resp: 'Equipo modificado correctamente.' });
}

const postEliminarEquipo = async (req, res) => {
    const { id } = req.params;

    if(!id) {
        return res.json({ resp: 'Error al intentar eliminar equipo' });
    }

    const equipo = await EquipoModel.findByPk(id);

    if(!equipo) {
        return res.json({ resp: 'Equipo no encontrado, intente nuevamente' });
    }

    await equipo.destroy();

    return res.json({ resp: 'Equipo eliminado correctamente' });
}

const getResults = async (req, res) => {
    let paginaActual = parseInt(req.query.pagina)
    const expresion = /^[1-999]$/

    if(!expresion.test(paginaActual)) {
        return;
    }

    // Limites y Offset para el paginador
    const limit = 4
    const offset = ((paginaActual*limit) - limit)

    const [clientes, total] = await Promise.all([
        CasaMatrizModel.findAll({
            limit,
            offset,
        }),
        CasaMatrizModel.count()
    ])

    const paginas = Math.ceil(total / limit);
    paginaActual = Number(paginaActual);
    res.json({clientes, paginas, paginaActual});
}

const getClient = async (req, res) => {
    const { id } = req.params;
    const cliente = await CasaMatrizModel.findByPk(id, { 
    });
    if(!cliente) {
        return;
    }
    res.json(cliente);
}

const getSucursales = async (req, res) => {
    let paginaActual = parseInt(req.query.pagina)
    const expresion = /^[1-999]$/

    if(!expresion.test(paginaActual)) {
        return;
    }

    // Limites y Offset para el paginador
    const limit = 5
    const offset = ((paginaActual*limit) - limit)

    const { id: casaMatrizId } = req.params
    if(!casaMatrizId) return;

    const [sucursales, total] = await Promise.all([
        SucursalModel.findAll({
            limit,
            offset,
            where: { casaMatrizId },
            include: [
                { model: CasaMatrizModel, as: 'casaMatriz' },
                {
                    model: EquipoModel, as: 'equipos',
                    attributes: []
                }
            ],
            order: [['fechaIngreso', 'DESC']],
            attributes: {
                include: [
                    [fn("COUNT", col("equipos.id")), "equiposCount"]
                ]
            },
            group: ['Sucursales.id', 'casaMatriz.id'],
            subQuery: false
        }),
        SucursalModel.count({
            where: { casaMatrizId },
        }),
    ])

    if(!sucursales) return;

    const paginas = Math.ceil(total / limit);
    paginaActual = Number(paginaActual);
    
    res.json({sucursales, total, paginas, paginaActual});
}

const getSucursalesPendientes = async (req, res) => {
    let paginaActual = parseInt(req.query.pagina)
    const expresion = /^[1-999]$/

    if(!expresion.test(paginaActual)) {
        return;
    }

    // Limites y Offset para el paginador
    const limit = 5
    const offset = ((paginaActual*limit) - limit)

    const { id: casaMatrizId } = req.params
    if(!casaMatrizId) return;

    const [sucursales, total] = await Promise.all([
        SucursalModel.findAll({
            limit,
            offset,
            where: { 
                casaMatrizId,
                estado: 2,
            },
            include: [
                { model: CasaMatrizModel, as: 'casaMatriz' },
                {
                    model: EquipoModel, as: 'equipos', 
                    attributes: []
                }
            ],
            order: [['fechaIngreso', 'DESC']],
            attributes: {
                include: [
                    [fn("COUNT", col("equipos.id")), "equiposCount"]
                ]
            },
            group: ['Sucursales.id', 'casaMatriz.id'],
            subQuery: false
        }),
        SucursalModel.count({
            where: { casaMatrizId },
        }),
    ])

    const paginas = Math.ceil(total / limit);
    paginaActual = Number(paginaActual);
    
    res.json({sucursales, total, limit, offset, paginas , paginaActual});
}

const getSucursalesTerminadas = async (req, res) => {
    let paginaActual = parseInt(req.query.pagina)
    const expresion = /^[1-999]$/

    if(!expresion.test(paginaActual)) {
        return;
    }

    // Limites y Offset para el paginador
    const limit = 5
    const offset = ((paginaActual*limit) - limit)

    const { id: casaMatrizId } = req.params
    if(!casaMatrizId) return;

    const [sucursales, total] = await Promise.all([
        SucursalModel.findAll({
            limit,
            offset,
            where: {
                casaMatrizId,
                estado: 3,
            },
            include: [
                { model: 
                    CasaMatrizModel, as: 'casaMatriz'
                },
                {
                    model: EquipoModel, as: 'equipos',
                    attributes: []
                }
            ],
            order: [['fechaIngreso', 'DESC']],
            attributes: {
                include: [
                    [fn("COUNT", col("equipos.id")), "equiposCount"]
                ]
            },
            group: ['Sucursales.id', 'casaMatriz.id'],
            subQuery: false
        }),
        SucursalModel.count({
            where: { casaMatrizId },
        }),
    ])

    const paginas = Math.ceil(total / limit);
    paginaActual = Number(paginaActual);
    
    res.json({sucursales, total, paginas});
}

const getSucursalById = async (req, res) => {
    const { id } = req.params;
    const sucursal = await SucursalModel.findOne({ 
        where: {
            id
        },
        include: [
            { model: CasaMatrizModel, as: 'casaMatriz' },
        ]
    });
    
    res.json(sucursal);
}

const getEquipmentsByCasaMatriz = async (req, res) => {
    const { id } = req.params;
    const equipos = await EquipoModel.findAll({ 
        where: {
            casaMatrizId: id
        },
        include: [
            { model: CasaMatrizModel, as: 'casaMatriz' }
        ]
    });
    if(!equipos) {
        return;
    }
    res.json(equipos);
}

const getTypeEquipments = async (req, res) => {
    const tipos = await TipoEquipoModel.findAll();

    res.json(tipos);
}

const getEquipmentForm = async (req, res) => {
    const { id } = req.params;

    try {
        const campos = await TipoEquipoCampoModel.findAll({
            where: {
                 tipoEquipoId: id 
            },
            include: [
                { model: CampoModel, as: 'campo' },
            ]
        });
        
        const camposTransformados = campos.map(({ campo }) => ({
            id: campo.id,
            name: campo.name,
            label: campo.label,
            type: campo.type,
            placeholder: campo.placeholder,
            required: campo.required,
        }));

        res.json(camposTransformados);
        } 
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los campos' });
    }
}

const getEquipmentsBySucursal = async (req, res) => {
    const { id } = req.params;

    let paginaActual = parseInt(req.query.pagina)
    const expresion = /^[1-999]$/

    if(!expresion.test(paginaActual)) {
        return;
    }

    // Limites y Offset para el paginador
    const limit = 8
    const offset = ((paginaActual*limit) - limit)

    const [equipos, total] = await Promise.all([
        EquipoModel.findAll({ 
            limit,
            offset,
            include: [
                { model: TipoEquipoModel, as: 'tipoEquipo' }
            ],
            where: {
                sucursalId: id,
            },
            order: [['numeroSecuencial', 'ASC']],
        }),
        EquipoModel.count({
            where: {
                sucursalId: id
            }
        })
    ])

    const paginas = Math.ceil(total / limit);
    paginaActual = Number(paginaActual);
    
    res.json({equipos, total, paginas, paginaActual});
}

const getEquipmentsPendientesBySucursal = async (req, res) => {
    const { id } = req.params;

    let paginaActual = parseInt(req.query.pagina)
    const expresion = /^[1-999]$/

    if(!expresion.test(paginaActual)) {
        return;
    }

    // Limites y Offset para el paginador
    const limit = 8
    const offset = ((paginaActual*limit) - limit)

    const [equipos, total] = await Promise.all([
        EquipoModel.findAll({ 
            limit,
            offset,
            include: [
                { model: TipoEquipoModel, as: 'tipoEquipo' }
            ],
            where: {
                sucursalId: id,
                estado: 2,
            },
            order: [['numeroSecuencial', 'ASC']],
        }),
        EquipoModel.count({
            where: {
                sucursalId: id,
                estado: 2,
            }
        })
    ])

    const paginas = Math.ceil(total / limit);
    paginaActual = Number(paginaActual);
    
    res.json({equipos, total, paginas, paginaActual});
}

const getEquipmentsTerminadosBySucursal = async (req, res) => {
    const { id } = req.params;

    let paginaActual = parseInt(req.query.pagina)
    const expresion = /^[1-999]$/

    if(!expresion.test(paginaActual)) {
        return;
    }

    // Limites y Offset para el paginador
    const limit = 8
    const offset = ((paginaActual*limit) - limit)

    const [equipos, total] = await Promise.all([
        EquipoModel.findAll({ 
            limit,
            offset,
            include: [
                { model: TipoEquipoModel, as: 'tipoEquipo' }
            ],
            where: {
                sucursalId: id,
                estado: 3,
            },
            order: [['numeroSecuencial', 'ASC']],
        }),
        EquipoModel.count({
            where: {
                sucursalId: id,
                estado: 3,
            }
        })
    ])

    const paginas = Math.ceil(total / limit);
    paginaActual = Number(paginaActual);
    
    res.json({equipos, total, paginas, paginaActual});
}

const getEquipmentById = async (req, res) => {
    const { id } = req.params;
    const equipo = await EquipoModel.findByPk(id, {
        include: [
            { model: TipoEquipoModel, as: 'tipoEquipo' },
            { model: CasaMatrizModel, as: 'casaMatriz' },
            { model: SucursalModel, as: 'sucursal' }
        ]
    });

    if(!equipo) {
        return;
    }
    res.json(equipo);
}



export {
    postCuenta,
    postModificarCuenta,
    postEliminarCuenta,

    login,

    postCliente,
    postModificarCliente,
    postEliminarCliente,

    postSucursal,
    postModificarSucursal,
    postEliminarSucursal,

    postEquipo,
    postObservacion,
    postModificarEquipo,
    postEliminarEquipo,

    // postUsuarioAsignado,
    // postModificarUsuarioAsignado,
    // postEliminarUsuarioAsignado,

    getResults,
    getClient,
    
    getSucursales,
    getSucursalesPendientes,
    getSucursalesTerminadas,

    getTypeEquipments,
    getEquipmentForm,

    getEquipmentsBySucursal,
    getEquipmentsPendientesBySucursal,
    getEquipmentsTerminadosBySucursal,

    getSucursalById,
    getEquipmentsByCasaMatriz,
    getEquipmentById
}