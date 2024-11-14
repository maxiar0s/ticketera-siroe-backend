import { levantamiento } from "../models/index.js";

const postForm = async (req, res) => {
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
    const solicitudes = await levantamiento.findAll({});    
    res.json(solicitudes);
}

const getResult = async (req, res) => {
    const { id } = req.params;
    const solicitudes = await levantamiento.findOne({ where: {id} });    
    res.json(solicitudes);
}

export {
    postForm,
    getResults,
    getResult
}