import express from "express";
import { handleUpload, processFile, handleFiles, processFiles, handleProjectAssets, processProjectAssets } from "../middleware/imagenes.js";
import protegerRutaAdmin from "../middleware/protegerRutaAdmin.js";
import protegerRutaTecnico from "../middleware/protegerRutaTecnico.js";
import protegerRuta from "../middleware/protegerRuta.js";
import {
  // Admin
  postCuenta,
  getVerificarCorreo,
  getTecnicosDisponibles,
  getEliminarCuenta,
  getUsuarios,
  getUsuario,
  getPerfil,
  actualizarPerfil,
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
  getEstadosSucursal, actualizarEstadoSucursal,
  crearTipoEquipo,
  actualizarTipoEquipo,
  eliminarTipoEquipo,
  obtenerCamposTipoEquipo,
  sincronizarCamposTipoEquipo,
  obtenerCampos,
  crearCampo,
  actualizarCampo,
  eliminarCampo,
  obtenerDepartamentosEquipo,
  crearDepartamentoEquipo,
  actualizarDepartamentoEquipo,
  eliminarDepartamentoEquipo,
  getProyectos,
  getProyecto,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  agregarAdjuntosProyecto,
  agregarBitacorasAProyecto,
  removerBitacoraDeProyecto,
  eliminarProyectoAdjunto
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
router.get("/perfil", protegerRuta, getPerfil);
router.put("/perfil", protegerRuta, actualizarPerfil);
router.get("/tecnicos", protegerRuta, getTecnicosDisponibles);
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

// Tipos de equipos y campos (solo administradores)
router.post("/tipos-equipos", protegerRutaAdmin, crearTipoEquipo);
router.put("/tipos-equipos/:id", protegerRutaAdmin, actualizarTipoEquipo);
router.delete("/tipos-equipos/:id", protegerRutaAdmin, eliminarTipoEquipo);
router.get(
  "/tipos-equipos/:id/campos",
  protegerRutaAdmin,
  obtenerCamposTipoEquipo
);
router.put(
  "/tipos-equipos/:id/campos",
  protegerRutaAdmin,
  sincronizarCamposTipoEquipo
);
router.get("/campos", protegerRutaAdmin, obtenerCampos);
router.post("/campos", protegerRutaAdmin, crearCampo);
router.put("/campos/:id", protegerRutaAdmin, actualizarCampo);
router.delete("/campos/:id", protegerRutaAdmin, eliminarCampo);
router.get(
  "/departamentos-equipos",
  protegerRutaTecnico,
  obtenerDepartamentosEquipo
);
router.post(
  "/departamentos-equipos",
  protegerRutaAdmin,
  crearDepartamentoEquipo
);
router.put(
  "/departamentos-equipos/:id",
  protegerRutaAdmin,
  actualizarDepartamentoEquipo
);
router.delete(
  "/departamentos-equipos/:id",
  protegerRutaAdmin,
  eliminarDepartamentoEquipo
);

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

// Proyectos
router.get("/proyectos", protegerRuta, getProyectos);
router.get("/proyectos/:id", protegerRuta, getProyecto);
router.post(
  "/proyectos",
  protegerRutaTecnico,
  handleProjectAssets,
  processProjectAssets,
  crearProyecto
);
router.put(
  "/proyectos/:id",
  protegerRutaTecnico,
  handleProjectAssets,
  processProjectAssets,
  actualizarProyecto
);
router.delete("/proyectos/:id", protegerRutaAdmin, eliminarProyecto);
router.post(
  "/proyectos/:id/adjuntos",
  protegerRutaTecnico,
  handleProjectAssets,
  processProjectAssets,
  agregarAdjuntosProyecto
);
router.post(
  "/proyectos/:id/bitacoras",
  protegerRutaTecnico,
  agregarBitacorasAProyecto
);
router.delete(
  "/proyectos/:id/bitacoras/:bitacoraId",
  protegerRutaTecnico,
  removerBitacoraDeProyecto
);
router.delete(
  "/proyectos/:id/adjuntos/:adjuntoId",
  protegerRutaTecnico,
  eliminarProyectoAdjunto
);

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
