import express from "express";
import {
  handleUpload,
  processFile,
  handleFiles,
  processFiles,
  handleProjectAssets,
  processProjectAssets,
  handleVehiculoSalidaArchivos,
  processVehiculoSalidaArchivos,
  handleDocumentoCliente,
  processDocumentoCliente,
} from "../middleware/imagenes.js";
import protegerRutaAdmin from "../middleware/protegerRutaAdmin.js";
import protegerRutaTecnico from "../middleware/protegerRutaTecnico.js";
import protegerRuta from "../middleware/protegerRuta.js";
import protegerRutaAdminComercial from "../middleware/protegerRutaAdminComercial.js";

// =====================================================
// Importaciones desde controladores refactorizados
// =====================================================

// Auth & Users
import {
  postCuenta,
  getVerificarCorreo,
  getTecnicosDisponibles,
  getEliminarCuenta,
  getUsuarios,
  getUsuario,
  getPerfil,
  actualizarPerfil,
} from "../controllers/authController.js";

// Clients & Branches
import {
  postCliente,
  postModificarCliente,
  postEliminarCliente,
  postSucursal,
  getEliminarSucursal,
  getResults,
  getClientesResumen,
  getClientesBitacora,
  getClientById,
  getSucursalesPorCliente,
  getSucursalById,
  getEstadosSucursal,
  actualizarEstadoSucursal,
} from "../controllers/clientController.js";

// Equipment
import {
  postEquipo,
  postObservacion,
  postModificarEquipo,
  deleteEquiptment,
  getEquipmentsByCasaMatriz,
  getTypeEquipments,
  getEquipmentForm,
  getEquipmentById,
  getEstadosEquipo,
  actualizarEstadoEquipo,
  actualizarSoloEstadoEquipo,
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
} from "../controllers/equipmentController.js";

// Bitacoras
import {
  getBitacoras,
  getBitacoraById,
  crearBitacora,
  actualizarBitacora,
  eliminarBitacora,
  getVisitasProgramadas,
  crearVisitaProgramada,
  eliminarVisitaProgramada,
} from "../controllers/bitacoraController.js";

// Tickets
import {
  getTickets,
  getTicketById,
  crearTicket,
  actualizarTicket,
  eliminarTicket,
} from "../controllers/ticketController.js";

// Chat de Tickets
import {
  getMensajesTicket,
  getActividadTicket,
  getTimelineTicket,
  enviarMensaje,
  marcarMensajesLeidos,
  getMensajesNoLeidosPorTicket,
} from "../controllers/chatController.js";

// Notifications
import {
  getNotificaciones,
  marcarNotificacionesLeidas,
} from "../controllers/notificationController.js";

// Projects
import {
  getProyectos,
  getProyecto,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  agregarAdjuntosProyecto,
  agregarBitacorasAProyecto,
  removerBitacoraDeProyecto,
  eliminarProyectoAdjunto,
} from "../controllers/projectController.js";

// Vehicles
import {
  getVehiculos,
  getVehiculo,
  crearVehiculo,
  actualizarVehiculo,
  eliminarVehiculo,
  crearVehiculoSalida,
  actualizarVehiculoSalida,
  eliminarVehiculoSalida,
  eliminarVehiculoSalidaAdjunto,
} from "../controllers/vehicleController.js";

// Documents & Logs
import {
  getDocumentacionClientes,
  crearDocumentoCliente,
  eliminarDocumentoCliente,
  getLogs,
  generarUrl,
} from "../controllers/documentController.js";

// Tags
import {
  getTags,
  crearTag,
  actualizarTag,
  eliminarTag,
} from "../controllers/tagController.js";

const router = express.Router();

// =====================================================
// Rutas de Administrador
// =====================================================

// Usuarios
router.post("/crear-modificar-cuenta", protegerRutaAdmin, postCuenta);
router.get("/verificar-correo", protegerRutaAdmin, getVerificarCorreo);
router.get("/eliminar-cuenta/:id", protegerRutaAdmin, getEliminarCuenta);
router.get("/usuarios", protegerRutaAdmin, getUsuarios);
router.get("/usuario/:id", protegerRutaAdmin, getUsuario);
router.get("/perfil", protegerRuta, getPerfil);
router.put("/perfil", protegerRuta, actualizarPerfil);
router.get("/tecnicos", protegerRuta, getTecnicosDisponibles);

// Clientes (Casas Matriz)
router.post(
  "/ingresar-cliente",
  protegerRutaAdmin,
  handleUpload,
  processFile,
  postCliente
);
router.post(
  "/modificar-cliente/:id",
  protegerRutaAdmin,
  handleUpload,
  processFile,
  postModificarCliente
);
router.post("/eliminar-cliente/:id", protegerRutaAdmin, postEliminarCliente);
router.delete("/clientes/:id", protegerRutaAdmin, postEliminarCliente);
router.get("/clientes/listado", protegerRutaAdmin, getClientesResumen);

// Documentación de clientes
router.get(
  "/documentacion",
  protegerRutaAdminComercial,
  getDocumentacionClientes
);
router.post(
  "/documentacion",
  protegerRutaAdminComercial,
  handleDocumentoCliente,
  processDocumentoCliente,
  crearDocumentoCliente
);
router.delete(
  "/documentacion/:id",
  protegerRutaAdminComercial,
  eliminarDocumentoCliente
);

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

// =====================================================
// Rutas de Administrador y Técnico
// =====================================================

router.post("/ingresar-equipo", protegerRutaTecnico, postEquipo);
router.post(
  "/modificar-equipo/:id",
  protegerRutaTecnico,
  handleUpload,
  processFile,
  postModificarEquipo
);
router.post("/eliminar-equipo/:id", protegerRutaTecnico, deleteEquiptment);

// Tipos de equipos y formularios
router.get("/tipos-equipos", protegerRuta, getTypeEquipments);
router.get("/obtener-formulario/:id", protegerRutaTecnico, getEquipmentForm);

// Estados de equipos
router.get("/estados-equipos", protegerRuta, getEstadosEquipo);
router.patch(
  "/estados-equipos/:id",
  protegerRutaTecnico,
  actualizarEstadoEquipo
);
router.post(
  "/actualizar-estado-equipo/:id",
  protegerRutaTecnico,
  actualizarSoloEstadoEquipo
);

// Estados de sucursales
router.get("/estados-sucursales", protegerRuta, getEstadosSucursal);
router.post(
  "/actualizar-estado-sucursal/:id",
  protegerRutaTecnico,
  actualizarEstadoSucursal
);

// =====================================================
// Rutas Generales (cualquier cuenta autenticada)
// =====================================================

router.post("/ingresar-observacion/:id", protegerRutaTecnico, postObservacion);

// Clientes
router.get("/clientes", protegerRuta, getResults);
router.get("/cliente/:id", protegerRuta, getClientById);
router.get("/cliente/:id/sucursales", protegerRuta, getSucursalesPorCliente);
router.get("/cliente/:id/equipos", protegerRuta, getEquipmentsByCasaMatriz);

// Tags de clientes
router.get("/clientes/:clienteId/tags", protegerRuta, getTags);
router.post("/clientes/:clienteId/tags", protegerRutaAdmin, crearTag);
router.put(
  "/clientes/:clienteId/tags/:tagId",
  protegerRutaAdmin,
  actualizarTag
);
router.delete(
  "/clientes/:clienteId/tags/:tagId",
  protegerRutaAdmin,
  eliminarTag
);

// Sucursales
router.get("/sucursal/:id", protegerRuta, getSucursalById);

// Notificaciones
router.get("/notificaciones", protegerRuta, getNotificaciones);
router.patch(
  "/notificaciones/leidas",
  protegerRuta,
  marcarNotificacionesLeidas
);

// Equipos
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

// Vehículos
router.get("/vehiculos", protegerRuta, getVehiculos);
router.get("/vehiculos/:id", protegerRuta, getVehiculo);
router.post(
  "/vehiculos",
  protegerRutaTecnico,
  handleUpload,
  processFile,
  crearVehiculo
);
router.put(
  "/vehiculos/:id",
  protegerRutaTecnico,
  handleUpload,
  processFile,
  actualizarVehiculo
);
router.delete("/vehiculos/:id", protegerRutaTecnico, eliminarVehiculo);
router.post(
  "/vehiculos/:vehiculoId/salidas",
  protegerRutaTecnico,
  handleVehiculoSalidaArchivos,
  processVehiculoSalidaArchivos,
  crearVehiculoSalida
);
router.put(
  "/vehiculos/:vehiculoId/salidas/:salidaId",
  protegerRutaTecnico,
  handleVehiculoSalidaArchivos,
  processVehiculoSalidaArchivos,
  actualizarVehiculoSalida
);
router.delete(
  "/vehiculos/:vehiculoId/salidas/:salidaId",
  protegerRutaTecnico,
  eliminarVehiculoSalida
);
router.delete(
  "/vehiculos/:vehiculoId/salidas/:salidaId/adjuntos/:adjuntoId",
  protegerRutaTecnico,
  eliminarVehiculoSalidaAdjunto
);

// Bitácoras
router.get("/bitacoras/clientes", protegerRuta, getClientesBitacora);
router.get("/bitacoras", protegerRuta, getBitacoras);
router.get("/bitacoras/:id", protegerRuta, getBitacoraById);
router.post(
  "/bitacoras",
  protegerRutaTecnico,
  handleFiles,
  processFiles,
  crearBitacora
);
router.put(
  "/bitacoras/:id",
  protegerRutaTecnico,
  handleFiles,
  processFiles,
  actualizarBitacora
);
router.delete("/bitacoras/:id", protegerRutaAdmin, eliminarBitacora);

// Tickets
router.get(
  "/tickets/mensajes-no-leidos",
  protegerRuta,
  getMensajesNoLeidosPorTicket
);
router.get("/tickets", protegerRuta, getTickets);
router.get("/tickets/:id", protegerRuta, getTicketById);
router.post(
  "/tickets",
  protegerRutaTecnico,
  handleFiles,
  processFiles,
  crearTicket
);
router.put(
  "/tickets/:id",
  protegerRutaTecnico,
  handleFiles,
  processFiles,
  actualizarTicket
);
router.delete("/tickets/:id", protegerRutaAdmin, eliminarTicket);

// Chat de Tickets
router.get("/tickets/:ticketId/chat", protegerRuta, getMensajesTicket);
router.post(
  "/tickets/:ticketId/chat",
  protegerRuta,
  handleFiles,
  processFiles,
  enviarMensaje
);
router.post(
  "/tickets/:ticketId/chat/leidos",
  protegerRuta,
  marcarMensajesLeidos
);
router.get("/tickets/:ticketId/actividad", protegerRuta, getActividadTicket);
router.get("/tickets/:ticketId/timeline", protegerRuta, getTimelineTicket);

// Visitas programadas
router.get("/visitas-programadas", protegerRuta, getVisitasProgramadas);
router.post("/visitas-programadas", protegerRutaTecnico, crearVisitaProgramada);
router.delete(
  "/visitas-programadas/:id",
  protegerRutaAdmin,
  eliminarVisitaProgramada
);

// Google Cloud Storage
router.get("/api/generar-url/:fileName", protegerRuta, generarUrl);

// Equipos (ruta alternativa)
router.delete("/equipos/:id", protegerRutaTecnico, deleteEquiptment);

// Logs del sistema
router.get("/logs", protegerRutaAdmin, getLogs);

export default router;
