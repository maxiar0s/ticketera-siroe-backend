import express from "express";
import { postCliente, getResults, getResult } from '../controller/apiController.js'

const router = express.Router();

router.post('/ingresar-levantamiento', postCliente);

router.get('/levantamientos', getResults);
router.get('/levantamiento/:id', getResult);

export default router