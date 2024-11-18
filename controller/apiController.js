import { ClienteModel, EquipamientoModel, UsuarioAsignadoModel } from "../models/index.js";

const postCliente = async (req, res) => {
    const { clientName,
        department,
        phone,
        generalInfo,
        email,
        location } = req.body;
    
    await ClienteModel.create({
        clientName,
        department,
        phone,
        generalInfo,
        email,
        location
    });

    res.json({ resp: 'Cliente creado satisfactoriamente.' });
}

const postEquipamiento = async (req, res) => {
    const { clienteId,
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
        comments } = req.body;
    
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

const postUsuarioAsignado = async (req, res) => {
    const { equipamientoId,
        name,
        email,
        phone } = req.body;
    
    await UsuarioAsignadoModel.create({
        equipamientoId,
        name,
        email,
        phone
    });

    res.json({ resp: `Usuario asignado creado satisfactoriamente para Equipamiento: ${equipamientoId}`});
}

const getResults = async (req, res) => {
    const clientes = await ClienteModel.findAll();
    res.json(clientes);
}

const getResult = async (req, res) => {
    const { id } = req.params;
    const cliente = await ClienteModel.findOne({ where: {id} });
    if(!cliente) {
        return res.json({ resp: 'Cliente no encontrado.'});
    }

    res.json(cliente);
}

export {
    postCliente,
    getResults,
    getResult
}