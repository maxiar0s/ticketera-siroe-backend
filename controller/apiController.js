import { levantamiento } from "../models/index.js";

const postForm = async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    const { clientName,
        dateTime,
        problemType,
        problemDescription,
        responsible,
        additionalNotes } = req.body;   
    
    const crearSolicitud = await levantamiento.create({
        clientName,
        dateTime,
        problemType,
        problemDescription,
        responsible,
        additionalNotes
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