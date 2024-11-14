import express from "express";
import { crearUsuario, login, recuperarAcceso } from '../controller/usuarioController.js';

const router = express.Router();

router.post('/crear-usuario', crearUsuario);
router.post('/login', login);
router.post('/recuperar-acceso', recuperarAcceso);

export default router