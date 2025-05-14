import express from "express";
import { handleUpload, processFile } from "../middleware/imagenes.js";
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
  getClientById,
  getSucursalById,
  getEquipmentsByCasaMatriz,
  getEquipmentById,
  generarUrl,
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
router.post("/modificar-cliente/:id", protegerRutaAdmin, postModificarCliente);
router.post("/eliminar-cliente/:id", protegerRutaAdmin, postEliminarCliente);
router.delete("/clientes/:id", protegerRutaAdmin, postEliminarCliente);

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
router.get("/estados-equipos", protegerRutaTecnico, getEstadosEquipo);
router.patch("/estados-equipos/:id", protegerRutaTecnico, actualizarEstadoEquipo);
router.post("/actualizar-estado-equipo/:id", protegerRutaTecnico, actualizarSoloEstadoEquipo);

//? Estados de sucursales
router.get("/estados-sucursales", protegerRutaTecnico, getEstadosSucursal);
router.post("/actualizar-estado-sucursal/:id", protegerRutaTecnico, actualizarEstadoSucursal);

// Permisos genericos para cualquier cuenta
router.post("/ingresar-observacion/:id", protegerRuta, postObservacion);

// Routes de obtención de datos
router.get("/clientes", protegerRuta, getResults);
router.get("/cliente/:id", protegerRuta, getClientById);
router.get("/cliente/:id/equipos", protegerRuta, getEquipmentsByCasaMatriz);

// Para obtener la sucursal por la ID
router.get("/sucursal/:id", protegerRuta, getSucursalById);

// Para obtener un equipo basado en su ID
router.get("/equipo/:id", protegerRuta, getEquipmentById);

// Consumo de imagenes Google Cloud Storage
router.get("/api/generar-url/:fileName", protegerRuta, generarUrl);

router.delete("/equipos/:id", protegerRuta, deleteEquiptment);

export default router;
