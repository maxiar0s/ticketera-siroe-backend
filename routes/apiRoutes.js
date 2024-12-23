import express from "express";
// import protegerRutaAdmin from "../middleware/protegerRutaAdmin.js";
import protegerRutaTecnico from "../middleware/protegerRutaTecnico.js";
import protegerRuta from "../middleware/protegerRuta.js";
import { 
    // Metodos Post
    postCuenta, postModificarCuenta, postEliminarCuenta,
    login,
    postCliente, postModificarCliente, postEliminarCliente, 
    postSucursal, postModificarSucursal, postEliminarSucursal, 
    postEquipo, postModificarEquipo, postEliminarEquipo, 
    // Metodos Get
    getResults, 
    getClient, 
    getSucursales, getSucursalesPendientes, getSucursalesTerminadas,
    getEquipmentsBySucursal, getEquipmentsPendientesBySucursal, getEquipmentsTerminadosBySucursal, 
    getSucursalById, getEquipmentsByCasaMatriz, getEquipmentById } from '../controller/apiController.js'

const router = express.Router();

// Login
// router.post('/login', login)

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
router.post('/ingresar-equipo', protegerRutaTecnico, postEquipo);
router.post('/modificar-equipo/:id', protegerRutaTecnico, postModificarEquipo);
router.post('/eliminar-equipo/:id', protegerRutaTecnico, postEliminarEquipo);

// Routes de obtención de datos
router.get('/clientes', protegerRuta, getResults);
router.get('/cliente/:id', protegerRuta, getClient);

// Para obtener sucursales con el respectivo estado
router.get('/cliente/:id/sucursales', protegerRuta, getSucursales);
router.get('/cliente/:id/sucursales/pendientes', protegerRuta, getSucursalesPendientes);
router.get('/cliente/:id/sucursales/terminados', protegerRuta, getSucursalesTerminadas);

// Para obtener la sucursal por la ID
router.get('/sucursal/:id', protegerRuta, getSucursalById);

// Para obtener los equipos de las sucursales con el respectivo estado
router.get('/sucursal/:id/equipos', protegerRuta, getEquipmentsBySucursal);
router.get('/sucursal/:id/equipos/pendientes', protegerRuta, getEquipmentsPendientesBySucursal);
router.get('/sucursal/:id/equipos/terminados', protegerRuta, getEquipmentsTerminadosBySucursal);

// Para obtener un equipo basado en su ID
router.get('/equipo/:id', protegerRuta, getEquipmentById);

router.get('/cliente/:id/equipos', getEquipmentsByCasaMatriz);


export default router