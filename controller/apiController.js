import jwt from "jsonwebtoken";
import { ClienteModel, CuentaModel, EquipoModel, SucursalModel, UsuarioAsignadoModel } from "../models/index.js";
import bcrypt from 'bcrypt';


const login = async (req, res) => {
    const { email, password } = req.body;

    const user = await CuentaModel.findOne({ where: { email }});

    if(!user) return;

    const matchPassword = await bcrypt.compare(password, user.password);
    if(!matchPassword) return;

    const userData = {
        name: user.name,
        telefono: user.telefono,
        email: user.email
    };

    const token = jwt.sign({ userData }, 'Secret_S1r03_S0p0rt3_Password');
    return res.json({token});
}

const postCuenta = async (req, res) => {
    const { name, telefono, email, password } = req.body;

    const hashed_password = await bcrypt.hash(password, 10);

    const cuenta = await CuentaModel.create({
        name,
        telefono,
        email,
        password: hashed_password,
        habilitado: 1
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
    // const { cuentaTecnicoId } = req.body;
    // if(!cuentaTecnicoId) {
    //     return res.json({ resp: 'Error al intentar crear cliente, intente nuevamente.' });
    // }
    // const tecnico = await CuentaModel.findByPk(id);
    // const { cuentaTecnicoId } = tecnico;
    const { rut,
        razonSocial,
        encargadoGeneral,
        correo,
        telefonoEncargado } = req.body;

    const nuevoCliente = await ClienteModel.create({
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

    const cliente = await ClienteModel.findByPk(id);

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

    const cliente = await ClienteModel.findByPk(id,{
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
        clienteId } = req.body;

    const nuevaSucursal = await SucursalModel.create({
        encargadoSucursal,
        correoSucursal,
        telefonoSucursal,
        sucursal,
        direccion,
        habilitado: 1,
        clienteId
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
    
    const { departamento } = req.body;

    const deptCode = departamento.substring(0, 4).toUpperCase();
    const numeroPadded = nextNumero.toString().padStart(3, '0');
    const codigoId = `SIRO${deptCode}${numeroPadded}`;
    console.log(codigoId);

    const { tipo,
        marca = null,
        modelo = null,
        usuario = null,
        numeroSerie = null,
        procesador = null,
        velocidadProcesador = null,
        ram = null,
        tipoAlmacenamiento = null,
        cantidadAlmacenamiento = null,
        sistemaOperativo = null,
        ofimatica = null,
        antivirus = null,
        observaciones = null } = req.body;
    
    await EquipoModel.create({
        numeroSecuencial: nextNumero,
        clienteId,
        sucursalId,
        tipo,
        marca,
        modelo,
        codigoId,
        departamento,
        usuario,
        numeroSerie,
        procesador,
        velocidadProcesador,
        ram,
        tipoAlmacenamiento,
        cantidadAlmacenamiento,
        sistemaOperativo,
        ofimatica,
        antivirus,
        observaciones
    });

    res.json({ resp: `Equipamiento creado satisfactoriamente para Cliente: ${clienteId}`});
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
        usuario,
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
        observaciones
        } = req.body;
    
    equipo.set({
        usuario,
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
        observaciones
    });

    equipo.save();

    return res.json({ resp: 'Equipo modificado correctamente' });
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

// const postUsuarioAsignado = async (req, res) => {
//     const { equipamientoId } = req.body;

//     if(!equipamientoId) {
//         return res.json({ resp: 'Error al asignar un usuario, intente nuevamente.' });
//     }

//     const { name ,
//         email ,
//         phone  } = req.body;
    
//     await UsuarioAsignadoModel.create({
//         equipamientoId,
//         name,
//         email,
//         phone
//     });

//     res.json({ resp: `Usuario asignado creado satisfactoriamente para Equipamiento: ${equipamientoId}`});
// }

// const postModificarUsuarioAsignado = async (req, res) => {
//     const { id } = req.params;

//     if(!id) {
//         return res.json({ resp: 'Error al intentar modificar el usuario asignado' });
//     }

//     const usuarioAsignado = await UsuarioAsignadoModel.findByPk(id);

//     if(!usuarioAsignado) {
//         return res.json({ resp: 'Usuario asignado no encontrado, intente nuevamente' });
//     }

//     const { name,
//         email,
//         phone } = req.body;

//     usuarioAsignado.set({
//         name,
//         email,
//         phone
//     })

//     usuarioAsignado.save();

//     return res.json({ resp: 'Usuario asignado modificado correctamente' });
// }

// const postEliminarUsuarioAsignado = async (req, res) => {
//     const { id } = req.params;

//     if(!id) {
//         return res.json({ resp: 'Error al intentar eliminar el usuario asignado' });
//     }

//     const usuarioAsignado = await UsuarioAsignadoModel.findByPk(id);

//     if(!usuarioAsignado) {
//         return res.json({ resp: 'Usuario asignado no encontrado, intente nuevamente' });
//     }

//     usuarioAsignado.destroy();

//     return res.json({ resp: 'Usuario asignado eliminado correctamente' });
// }

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
        ClienteModel.findAll({
            limit,
            offset,
            include: [
                { model: EquipoModel }
            ]
        }),
        ClienteModel.count({
            limit,
            offset,
            include: [
                { model: EquipoModel }
            ]
        }),
    ])

    const paginas = Math.ceil(total / limit);
    paginaActual = Number(paginaActual);
    res.json({clientes, total, limit, offset, paginas , paginaActual});
}

const getClient = async (req, res) => {
    const { id } = req.params;
    const cliente = await ClienteModel.findByPk(id, { 
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

    const { id: clienteId } = req.params
    if(!clienteId) return;

    const [sucursales, total] = await Promise.all([
        SucursalModel.findAll({
            limit,
            offset,
            where: { clienteId },
            include: [
                { model: ClienteModel }
            ]
        }),
        SucursalModel.count({
            limit,
            offset,
            include: [
                { model: ClienteModel }
            ]
        }),
    ])

    const paginas = Math.ceil(total / limit);
    paginaActual = Number(paginaActual);
    
    res.json({sucursales, total, limit, offset, paginas , paginaActual});
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

    const { id: clienteId } = req.params
    if(!clienteId) return;

    const [sucursales, total] = await Promise.all([
        SucursalModel.findAll({
            limit,
            offset,
            where: { clienteId },
            include: [
                { model: ClienteModel }
            ]
        }),
        SucursalModel.count({
            limit,
            offset,
            include: [
                { model: ClienteModel }
            ]
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

    const { id: clienteId } = req.params
    if(!clienteId) return;

    const [sucursales, total] = await Promise.all([
        SucursalModel.findAll({
            limit,
            offset,
            where: { clienteId },
            include: [
                { model: ClienteModel }
            ]
        }),
        SucursalModel.count({
            limit,
            offset,
            include: [
                { model: ClienteModel }
            ]
        }),
    ])

    const paginas = Math.ceil(total / limit);
    paginaActual = Number(paginaActual);
    
    res.json({sucursales, total, limit, offset, paginas , paginaActual});
}

const getSucursalById = async (req, res) => {
    const { id } = req.params;
    const sucursal = await SucursalModel.findOne({ 
        where: {
            id
        },
        include: [
            { model: ClienteModel },
            { model: EquipoModel }
        ]
    });
    if(!sucursal) {
        return;
    }
    res.json(sucursal);
}

const getEquipmentsByCasaMatriz = async (req, res) => {
    const { id } = req.params;
    const equipos = await EquipoModel.findAll({ 
        where: {
            clienteId: id
        },
        include: [
            { model: ClienteModel }
        ]
    });
    if(!equipos) {
        return;
    }
    res.json(equipos);
}

const getEquipmentsBySucursal = async (req, res) => {
    const { id } = req.params;
    const equipos = await EquipoModel.findAll({ 
        where: {
            sucursalId: id
        },
        include: [
            { model: ClienteModel }
        ]
    });
    if(!equipos) {
        return;
    }
    res.json(equipos);
}

const getEquipmentById = async (req, res) => {
    const { id } = req.params;
    const equipo = await EquipoModel.findByPk(id, {
        include: [
            { model: ClienteModel },
            { model: SucursalModel }
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

    getSucursalById,
    getEquipmentsByCasaMatriz,
    getEquipmentsBySucursal,
    getEquipmentById
}