import express from "express";
import { 
    postCuenta, postModificarCuenta, postEliminarCuenta,
    login,
    postCliente, postModificarCliente, postEliminarCliente, 
    postSucursal, postModificarSucursal, postEliminarSucursal, 
    postEquipo, postModificarEquipo, postEliminarEquipo, 
    // postUsuarioAsignado, postModificarUsuarioAsignado, postEliminarUsuarioAsignado,
    getResults, getClient, getSucursales, getSucursalById, getEquipmentsByCasaMatriz, getEquipmentsBySucursal, getEquipmentById } from '../controller/apiController.js'

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

router.post('/ingresar-sucursal', postSucursal);
router.post('/modificar-sucursal/:id', postModificarSucursal);
router.post('/eliminar-sucursal/:id', postEliminarSucursal);

// Administrador y Tecnico
router.post('/ingresar-equipo', postEquipo);
router.post('/modificar-equipo/:id', postModificarEquipo);
router.post('/eliminar-equipo/:id', postEliminarEquipo);
// router.post('/ingresar-usuario-asignado', postUsuarioAsignado);
// router.post('/modificar-usuario-asignado/:id', postModificarUsuarioAsignado);
// router.post('/eliminar-usuario-asignado/:id', postEliminarUsuarioAsignado);

// Routes de obtención de datos
router.get('/clientes', getResults);
router.get('/cliente/:id', getClient);
router.get('/cliente/:id/sucursales', getSucursales);
router.get('/sucursal/:id', getSucursalById);
router.get('/cliente/:id/equipos', getEquipmentsByCasaMatriz);
router.get('/sucursal/:id/equipos', getEquipmentsBySucursal);
router.get('/equipo/:id', getEquipmentById);

export default router