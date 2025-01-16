import jwt from "jsonwebtoken";
import bcrypt from 'bcrypt';
import { col, fn, Op } from "sequelize";
import bucket from '../config/gcs.js';

import { CampoModel, CasaMatrizModel, CuentaModel, EquipoModel, ObservacionModel, SucursalModel, TipoEquipoCampoModel, TipoEquipoModel } from "../models/index.js";

const generateSignedUrl = async (fileName) => {
    try {
        const file = bucket.file(fileName);
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
        });
        return url;
      } catch (error) {
        console.error(error);
        throw error;
      }
  };

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
    const imagenName = req.uploadedFile
    const nuevoCliente = await CasaMatrizModel.create({
        rut,
        razonSocial,
        imagen: imagenName,
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

    const tipoEquipo = await TipoEquipoModel.findOne({
        where: {
            id: tipoEquipoId
        }
    });

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

    let paginas = Math.ceil(total / limit);
    if(total == 0) {
        paginas = 1
    }
    
    res.json({ clientes, paginas });
}

const getClientById = async (req, res) => {
    let paginaActual = parseInt(req.query.pagina)
    const expresion = /^[1-999]$/

    if(!expresion.test(paginaActual)) {
        paginaActual = 1;
    }

    // Limites y Offset para el paginador
    const limit = 5
    const offset = ((paginaActual*limit) - limit)

    const { id } = req.params;
    const { option } = req.query;
    let estado = { [Op.in]: [1, 2, 3] };
    if(option === "Terminados") {
        estado = 3;
    } else if (option === "Pendientes") {
        estado = 2;
    }

    const [cliente, total] = await Promise.all([
        CasaMatrizModel.findByPk(id, {
            include: [
                { model: SucursalModel, as: 'sucursales',
                    limit,
                    offset,
                    where: { estado },
                    include: [
                        { model: EquipoModel, as: 'equipos', attributes: [] },
                    ],
                    order: [['fechaIngreso', 'DESC']],
                    attributes: {
                        include: [
                            [fn("COUNT", col("equipos.id")), "equiposCount"]
                        ]
                    },
                    group: ['Sucursales.id'],
                    subQuery: false
                 }
            ]
        }),
        CasaMatrizModel.count({
            where: { id },
            include: [
                { model: SucursalModel, as: 'sucursales',
                    where: { estado }      
                }
            ]
        }),
    ])

    let paginas = Math.ceil(total / limit);
    if(total == 0) {
        paginas = 1
    }

    return res.json({cliente, paginas});
}

const getSucursalById = async (req, res) => {
    let paginaActual = parseInt(req.query.pagina)
    const expresion = /^[1-999]$/
    
    if(!expresion.test(paginaActual)) {
        paginaActual = 1;
    }
    
    // Limites y Offset para el paginador
    const limit = 8
    const offset = ((paginaActual*limit) - limit)
    
    const { id } = req.params;
    const { option } = req.query;
    let estado = { [Op.in]: [1, 2, 3] };
    if(option === "Terminados") {
        estado = 3;
    } else if (option === "Pendientes") {
        estado = 2;
    }

    const [sucursal, total] = await Promise.all([
        SucursalModel.findByPk(id, { 
            include: [
                { model: CasaMatrizModel, as: 'casaMatriz' },
                { model: EquipoModel, as: 'equipos',
                    limit,
                    offset,
                    include: [
                        { model: TipoEquipoModel, as: 'tipoEquipo' }
                    ],
                    where: { estado },
                    order: [['numeroSecuencial', 'ASC']],
                }
            ]
        }),
        SucursalModel.count({
            where: {
                id,
            },
            include: [
                { model: EquipoModel, as: 'equipos',
                    where: { estado }
                }
            ]
        })
    ])

    let paginas = Math.ceil(total / limit);
    if(total == 0) {
        paginas = 1
    }

    return res.json({sucursal, paginas});
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

const generarUrl = async (req, res) => {
    try {
        const { fileName } = req.params;
        const signedUrl = await generateSignedUrl(fileName);
        res.json({ signedUrl });
      } catch (error) {
        res.status(500).json({ error: 'No se pudo generar el signed URL.' });
      }
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

    getResults,
    getClientById,

    getTypeEquipments,
    getEquipmentForm,

    getSucursalById,
    getEquipmentsByCasaMatriz,
    getEquipmentById,

    generarUrl
}