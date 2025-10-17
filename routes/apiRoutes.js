import express from "express";
import { handleUpload, processFile, handleFiles, processFiles } from "../middleware/imagenes.js";
import protegerRutaAdmin from "../middleware/protegerRutaAdmin.js";
import protegerRutaTecnico from "../middleware/protegerRutaTecnico.js";
import protegerRuta from "../middleware/protegerRuta.js";
import {
  // Admin
  postCuenta,
  getVerificarCorreo,
  getEliminarCuenta,
  getUsuarios,
  getUsuario,
  postCliente,
  postModificarCliente,
  postEliminarCliente,
  postSucursal,
  getEliminarSucursal,

  // Admin y Técnico
  postEquipo,
  postModificarEquipo,
  deleteEquiptment,
  getTypeEquipments,
  getEquipmentForm,

  // Genericos
  postObservacion,
  getResults,
  getClientesResumen,
  getClientesBitacora,
  getClientById,
  getSucursalesPorCliente,
  getSucursalById,
  getEquipmentsByCasaMatriz,
  getEquipmentById,
  generarUrl,
  getBitacoras,
  getBitacoraById,
  crearBitacora,
  actualizarBitacora,
  eliminarBitacora,
  getVisitasProgramadas,
  crearVisitaProgramada,
  eliminarVisitaProgramada,
  //? Estados de equipos
  getEstadosEquipo,actualizarEstadoEquipo, actualizarSoloEstadoEquipo,
  //? Estados de sucursales
  getEstadosSucursal, actualizarEstadoSucursal
} from "../controller/apiController.js";

const router = express.Router();

// Permisos de Administrador
// Usuarios
router.post("/crear-modificar-cuenta", protegerRutaAdmin, postCuenta);
router.get("/verificar-correo", protegerRutaAdmin, getVerificarCorreo);
router.get("/eliminar-cuenta/:id", protegerRutaAdmin, getEliminarCuenta);

// Para obtener todos los usuarios
router.get("/usuarios", protegerRutaAdmin, getUsuarios);
// Para obtener 1 usuario por ID
router.get("/usuario/:id", protegerRutaAdmin, getUsuario);
// Casas matricez
router.post(
  "/ingresar-cliente",
  protegerRutaAdmin,
  handleUpload,
  processFile,
  postCliente
);
//gestion de clientes
router.post("/modificar-cliente/:id", protegerRutaAdmin, handleUpload, processFile, postModificarCliente);
router.post("/eliminar-cliente/:id", protegerRutaAdmin, postEliminarCliente);
router.delete("/clientes/:id", protegerRutaAdmin, postEliminarCliente);
router.get("/clientes/listado", protegerRutaAdmin, getClientesResumen);

// Sucursales
router.post("/ingresar-sucursal", protegerRutaAdmin, postSucursal);
router.get("/eliminar-sucursal/:id", protegerRutaAdmin, getEliminarSucursal);

// Permisos de Administrador y Tecnico
router.post("/ingresar-equipo", protegerRutaTecnico, postEquipo);
router.post(
  "/modificar-equipo/:id",
  protegerRutaTecnico,
  handleUpload,
  processFile,
  postModificarEquipo
);

router.post("/eliminar-equipo/:id", protegerRutaTecnico, deleteEquiptment);

// Para obtener todos los tipos de equipos y su formulario
router.get("/tipos-equipos", protegerRutaTecnico, getTypeEquipments);
router.get("/obtener-formulario/:id", protegerRutaTecnico, getEquipmentForm);

//? Estados de equipos
router.get("/estados-equipos", protegerRuta, getEstadosEquipo);
router.patch("/estados-equipos/:id", protegerRutaTecnico, actualizarEstadoEquipo);
router.post("/actualizar-estado-equipo/:id", protegerRutaTecnico, actualizarSoloEstadoEquipo);

//? Estados de sucursales
router.get("/estados-sucursales", protegerRuta, getEstadosSucursal);
router.post("/actualizar-estado-sucursal/:id", protegerRutaTecnico, actualizarEstadoSucursal);

// Permisos genericos para cualquier cuenta
router.post("/ingresar-observacion/:id", protegerRutaTecnico, postObservacion);

// Routes de obtención de datos
router.get("/clientes", protegerRuta, getResults);
router.get("/cliente/:id", protegerRuta, getClientById);
router.get("/cliente/:id/sucursales", protegerRuta, getSucursalesPorCliente);
router.get("/cliente/:id/equipos", protegerRuta, getEquipmentsByCasaMatriz);

// Para obtener la sucursal por la ID
router.get("/sucursal/:id", protegerRuta, getSucursalById);

// Para obtener un equipo basado en su ID
router.get("/equipo/:id", protegerRuta, getEquipmentById);

// Bitacoras
router.get("/bitacoras/clientes", protegerRuta, getClientesBitacora);
router.get("/bitacoras", protegerRuta, getBitacoras);
router.get("/bitacoras/:id", protegerRuta, getBitacoraById);
router.post("/bitacoras", protegerRutaTecnico, handleFiles, processFiles, crearBitacora);
router.put("/bitacoras/:id", protegerRutaTecnico, handleFiles, processFiles, actualizarBitacora);
router.delete("/bitacoras/:id", protegerRutaAdmin, eliminarBitacora);

// Visitas programadas
router.get("/visitas-programadas", protegerRuta, getVisitasProgramadas);
router.post("/visitas-programadas", protegerRutaTecnico, crearVisitaProgramada);
router.delete("/visitas-programadas/:id", protegerRutaAdmin, eliminarVisitaProgramada);

// Consumo de imagenes Google Cloud Storage
router.get("/api/generar-url/:fileName", protegerRuta, generarUrl);

router.delete("/equipos/:id", protegerRutaTecnico, deleteEquiptment);

export default router;
