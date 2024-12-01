import express from "express";
import { 
    postCuenta, postModificarCuenta, postEliminarCuenta,
    login,
    postCliente, postModificarCliente, postEliminarCliente, 
    postEquipo, postModificarEquipo, postEliminarEquipo, 
    postUsuarioAsignado, postModificarUsuarioAsignado, postEliminarUsuarioAsignado,
    getResults, getResultById } from '../controller/apiController.js'

const router = express.Router();

// Login
router.post('/login', login)

// Administrador
router.post('/crear-cuenta', postCuenta)
router.post('/modificar-cuenta/:id', postModificarCuenta)
router.post('/eliminar-cuenta/:id', postEliminarCuenta)

router.post('/ingresar-cliente', postCliente);
router.post('/modificar-cliente/:id', postModificarCliente);
router.post('/eliminar-cliente/:id', postEliminarCliente);


// Tecnico
router.post('/ingresar-equipo', postEquipo);
router.post('/modificar-equipo/:id', postModificarEquipo);
router.post('/eliminar-equipo/:id', postEliminarEquipo);
router.post('/ingresar-usuario-asignado', postUsuarioAsignado);
router.post('/modificar-usuario-asignado/:id', postModificarUsuarioAsignado);
router.post('/eliminar-usuario-asignado/:id', postEliminarUsuarioAsignado);

router.get('/clientes', getResults);
router.get('/cliente/:id', getResultById);

export default router