import { ClienteModel, CuentaModel, EquipamientoModel, UsuarioAsignadoModel } from "../models/index.js";

const postCliente = async (req, res) => {
    const { cuentaTecnicoId } = req.body;

    // if(!cuentaTecnicoId) {
    //     return res.json({ resp: 'Error al intentar crear cliente, intente nuevamente.' });
    // }

    // TODO realizar luego de implementar JWT
    // const tecnico = await CuentaModel.findByPk(id);
    // const { cuentaTecnicoId } = tecnico;
    
    const { clientName,
        department,
        phone,
        generalInfo,
        email,
        location } = req.body;
    
    const nuevoCliente = await ClienteModel.create({
        cuentaTecnicoId,
        clientName,
        department,
        phone,
        generalInfo,
        email,
        location
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

    const { clientName,
        department,
        phone,
        generalInfo,
        email,
        location } = req.body;

    cliente.set({
        clientName,
        department,
        phone,
        generalInfo,
        email,
        location
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
            { model: EquipamientoModel,
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

const postEquipamiento = async (req, res) => {
    const { clienteId } = req.body;

    if(!clienteId) {
        return res.json({ resp: 'Error al intentar crear equipamiento, intente nuevamente.' });
    }

    const { equipmentType,
        brand = null,
        model = null,
        serialNumber = null,
        ipAddress = null,
        processor = null,
        ram = null,
        storage = null,
        os = null,
        officeSuite = null,
        softwareLicenses = null,
        physicalState = null,
        lastMaintenance = null,
        currentIssues = null,
        monitors = null,
        keyboard = null,
        mouse = null,
        otherPeripherals = null,
        antivirus = null,
        backupSoftware = null,
        lastBackup = null,
        securitySoftware = null,
        comments = null } = req.body;
    
    await EquipamientoModel.create({
        clienteId,
        equipmentType,
        brand,
        model,
        serialNumber,
        ipAddress,
        processor,
        ram,
        storage,
        os,
        officeSuite,
        softwareLicenses,
        physicalState,
        lastMaintenance,
        currentIssues,
        monitors,
        keyboard,
        mouse,
        otherPeripherals,
        antivirus,
        backupSoftware,
        lastBackup,
        securitySoftware,
        comments
    });

    res.json({ resp: `Equipamiento creado satisfactoriamente para Cliente: ${clienteId}`});
}

const postModificarEquipamiento = async (req, res) => {
    const { id } = req.params;

    if(!id) {
        return res.json({ resp: 'Error al intentar modificar equipamiento' });
    }

    const equipamiento = await EquipamientoModel.findByPk(id);

    if(!equipamiento) {
        return res.json({ resp: 'Equipamiento no encontrado, intente nuevamente' });
    }

    const { equipmentType,
        brand = null,
        model = null,
        serialNumber = null,
        ipAddress = null,
        processor = null,
        ram = null,
        storage = null,
        os = null,
        officeSuite = null,
        softwareLicenses = null,
        physicalState = null,
        lastMaintenance = null,
        currentIssues = null,
        monitors = null,
        keyboard = null,
        mouse = null,
        otherPeripherals = null,
        antivirus = null,
        backupSoftware = null,
        lastBackup = null,
        securitySoftware = null,
        comments = null } = req.body;
    
    equipamiento.set({
        equipmentType,
        brand,
        model,
        serialNumber,
        ipAddress,
        processor,
        ram,
        storage,
        os,
        officeSuite,
        softwareLicenses,
        physicalState,
        lastMaintenance,
        currentIssues,
        monitors,
        keyboard,
        mouse,
        otherPeripherals,
        antivirus,
        backupSoftware,
        lastBackup,
        securitySoftware,
        comments
    });

    equipamiento.save();

    return res.json({ resp: 'Equipamiento modificado correctamente' });
}

const postEliminarEquipamiento = async (req, res) => {
    const { id } = req.params;

    if(!id) {
        return res.json({ resp: 'Error al intentar modificar equipamiento' });
    }

    const equipamiento = await EquipamientoModel.findByPk(id);

    if(!equipamiento) {
        return res.json({ resp: 'Equipamiento no encontrado, intente nuevamente' });
    }

    await equipamiento.setUsuariosAsignados([]); 
      
    for (const usuario of equipamiento.UsuariosAsignados) {
        await usuario.destroy();
    }
    await equipamiento.destroy();

    return res.json({ resp: 'Equipamiento eliminado correctamente' });
}

const postUsuarioAsignado = async (req, res) => {
    const { equipamientoId } = req.body;

    if(!equipamientoId) {
        return res.json({ resp: 'Error al asignar un usuario, intente nuevamente.' });
    }

    const { name = null,
        email = null,
        phone = null } = req.body;
    
    await UsuarioAsignadoModel.create({
        equipamientoId,
        name,
        email,
        phone
    });

    res.json({ resp: `Usuario asignado creado satisfactoriamente para Equipamiento: ${equipamientoId}`});
}

const postModificarUsuarioAsignado = async (req, res) => {
    const { id } = req.params;

    if(!id) {
        return res.json({ resp: 'Error al intentar modificar el usuario asignado' });
    }

    const usuarioAsignado = await UsuarioAsignadoModel.findByPk(id);

    if(!usuarioAsignado) {
        return res.json({ resp: 'Usuario asignado no encontrado, intente nuevamente' });
    }

    const { name,
        email,
        phone } = req.body;

    usuarioAsignado.set({
        name,
        email,
        phone
    })

    usuarioAsignado.save();

    return res.json({ resp: 'Usuario asignado modificado correctamente' });
}

const postEliminarUsuarioAsignado = async (req, res) => {
    const { id } = req.params;

    if(!id) {
        return res.json({ resp: 'Error al intentar eliminar el usuario asignado' });
    }

    const usuarioAsignado = await UsuarioAsignadoModel.findByPk(id);

    if(!usuarioAsignado) {
        return res.json({ resp: 'Usuario asignado no encontrado, intente nuevamente' });
    }

    usuarioAsignado.destroy();

    return res.json({ resp: 'Usuario asignado eliminado correctamente' });
}

const getResults = async (req, res) => {
    const clientes = await ClienteModel.findAll({
        include: [
            { model: CuentaModel },
            { model: EquipamientoModel,
                include: [
                    { model: UsuarioAsignadoModel }
                ]
             }
        ]
    });
    res.json(clientes);
}

const getResultById = async (req, res) => {
    const { id } = req.params;
    const cliente = await ClienteModel.findOne({ 
        where: {
            id
        },
        include: [
            { model: CuentaModel },
            { model: EquipamientoModel,
                include: [
                    { model: UsuarioAsignadoModel }
                ]
             }
        ]
    });
    if(!cliente) {
        return res.json({ resp: 'Cliente no encontrado.'});
    }

    res.json(cliente);
}

export {
    postCliente,
    postModificarCliente,
    postEliminarCliente,

    postEquipamiento,
    postModificarEquipamiento,
    postEliminarEquipamiento,

    postUsuarioAsignado,
    postModificarUsuarioAsignado,
    postEliminarUsuarioAsignado,

    getResults,
    getResultById
}