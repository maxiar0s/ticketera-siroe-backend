import express from "express";
import { postForm, getResults, getResult } from '../controller/apiController.js'

const router = express.Router();

router.post('/ingresar-levantamiento', postForm);

router.get('/levantamientos', getResults);
router.get('/levantamiento/:id', getResult);

export default router