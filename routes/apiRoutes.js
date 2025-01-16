import express from "express";
import { handleUpload, processFile } from '../middleware/imagenes.js'
// import protegerRutaAdmin from "../middleware/protegerRutaAdmin.js";
// import protegerRutaTecnico from "../middleware/protegerRutaTecnico.js";
// import protegerRuta from "../middleware/protegerRuta.js";
import { 
    // Metodos Post
    postCuenta, postModificarCuenta, postEliminarCuenta,
    login,
    postCliente, postModificarCliente, postEliminarCliente, 
    postSucursal, postModificarSucursal, postEliminarSucursal, 
    postEquipo, postObservacion, postModificarEquipo, postEliminarEquipo, 
    // Metodos Get
    getResults, 
    getClientById, 
    getTypeEquipments, getEquipmentForm,
    getSucursalById, getEquipmentsByCasaMatriz, getEquipmentById,
    generarUrl } from '../controller/apiController.js';

const router = express.Router();

// Login
// router.post('/login', login)

// Administrador
router.post('/crear-cuenta', postCuenta);
router.post('/modificar-cuenta/:id', postModificarCuenta);
router.post('/eliminar-cuenta/:id', postEliminarCuenta);

router.post('/ingresar-cliente', handleUpload, processFile, postCliente);
router.post('/modificar-cliente/:id', postModificarCliente);
router.post('/eliminar-cliente/:id', postEliminarCliente);

router.post('/ingresar-sucursal', postSucursal);
router.post('/modificar-sucursal/:id', postModificarSucursal);
router.post('/eliminar-sucursal/:id', postEliminarSucursal);

// Administrador y Tecnico
router.post('/ingresar-equipo', postEquipo);
router.post('/ingresar-observacion/:id', postObservacion)
router.post('/modificar-equipo/:id', handleUpload, processFile, postModificarEquipo);
router.post('/eliminar-equipo/:id', postEliminarEquipo);

// Routes de obtención de datos
router.get('/clientes', getResults);
router.get('/cliente/:id', getClientById);

// Para obtener la sucursal por la ID
router.get('/sucursal/:id', getSucursalById);

// Para obtener todos los tipos de equipos y su formulario
router.get('/tipos-equipos', getTypeEquipments);
router.get('/obtener-formulario/:id', getEquipmentForm);

// Para obtener un equipo basado en su ID
router.get('/equipo/:id', getEquipmentById);

router.get('/cliente/:id/equipos', getEquipmentsByCasaMatriz);

// Consumo de imagenes Google Cloud Storage
router.get('/api/generar-url/:fileName', generarUrl)

export default router