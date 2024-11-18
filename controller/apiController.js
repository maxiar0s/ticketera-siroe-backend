import { levantamiento } from "../models/index.js";

const postForm = async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    const { clientName,
        department,
        phone,
        generalInfo,
        equipmentType,
        brand,
        model,
        serialNumber,
        ipAddress,
        assignedUser,
        email,
        location,
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
    
    const crearSolicitud = await levantamiento.create({
        clientName,
        department,
        phone,
        generalInfo,
        equipmentType,
        brand,
        model,
        serialNumber,
        ipAddress,
        assignedUser,
        email,
        location,
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

    res.json(crearSolicitud);
}

const getResults = async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    const solicitudes = await levantamiento.findAll({});    
    res.json(solicitudes);
}

const getResult = async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    const { id } = req.params;
    const solicitudes = await levantamiento.findOne({ where: {id} });    
    res.json(solicitudes);
}

export {
    postForm,
    getResults,
    getResult
}