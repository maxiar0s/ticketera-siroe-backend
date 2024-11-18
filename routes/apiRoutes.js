import express from "express";
import { postCliente, postEquipamiento, postUsuarioAsignado, getResults, getResult } from '../controller/apiController.js'

const router = express.Router();

router.post('/ingresar-levantamiento', postCliente);
router.post('/ingresar-equipamiento', postEquipamiento);
router.post('/ingresar-usuario-asignado', postUsuarioAsignado);

router.get('/levantamientos', getResults);
router.get('/levantamiento/:id', getResult);

export default router