import express from "express";
import { 
    postCliente, postModificarCliente, postEliminarCliente, 
    postEquipamiento, postModificarEquipamiento, postEliminarEquipamiento, 
    postUsuarioAsignado, postModificarUsuarioAsignado, postEliminarUsuarioAsignado,
    getResults, getResult } from '../controller/apiController.js'

const router = express.Router();

router.post('/ingresar-levantamiento', postCliente);
router.post('/modificar-levantamiento/:id', postModificarCliente);
router.post('/eliminar-levantamiento/:id', postEliminarCliente);

router.post('/ingresar-equipamiento', postEquipamiento);
router.post('/modificar-equipamiento/:id', postModificarEquipamiento);
router.post('/eliminar-equipamiento/:id', postEliminarEquipamiento);

router.post('/ingresar-usuario-asignado', postUsuarioAsignado);
router.post('/modificar-usuario-asignado/:id', postModificarUsuarioAsignado);
router.post('/eliminar-usuario-asignado/:id', postEliminarUsuarioAsignado);

router.get('/levantamientos', getResults);
router.get('/levantamiento/:id', getResult);

export default router