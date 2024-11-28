import express from "express";
import { 
    postCliente, postModificarCliente, postEliminarCliente, 
    postEquipo, postModificarEquipo, postEliminarEquipo, 
    postUsuarioAsignado, postModificarUsuarioAsignado, postEliminarUsuarioAsignado,
    getResults, getResultById } from '../controller/apiController.js'

const router = express.Router();

router.post('/ingresar-cliente', postCliente);
router.post('/modificar-cliente/:id', postModificarCliente);
router.post('/eliminar-cliente/:id', postEliminarCliente);

router.post('/ingresar-equipo', postEquipo);
router.post('/modificar-equipo/:id', postModificarEquipo);
router.post('/eliminar-equipo/:id', postEliminarEquipo);

router.post('/ingresar-usuario-asignado', postUsuarioAsignado);
router.post('/modificar-usuario-asignado/:id', postModificarUsuarioAsignado);
router.post('/eliminar-usuario-asignado/:id', postEliminarUsuarioAsignado);

router.get('/levantamientos', getResults);
router.get('/levantamiento/:id', getResultById);

export default router