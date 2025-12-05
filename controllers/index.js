/**
 * @fileoverview Índice de controladores.
 * Re-exporta todas las funciones de los controladores separados por dominio.
 *
 * Este archivo actúa como punto de entrada único para mantener
 * compatibilidad con las rutas existentes durante la migración.
 */

// Auth & Users
export {
  postCuenta,
  getTecnicosDisponibles,
  getVerificarCorreo,
  postModificarCuenta,
  getEliminarCuenta,
  getUsuarios,
  getUsuario,
  getPerfil,
  actualizarPerfil,
  getAuthorizedClientIds,
} from "./authController.js";

// Clients & Branches
export {
  postCliente,
  postEliminarCliente,
  postModificarCliente,
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
  obtenerConteoVisitasPorCliente,
} from "./clientController.js";

// Re-export remaining functions from original apiController
// TODO: Move these to their respective controllers
export {
  // Equipment
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
  // Equipment Types
  crearTipoEquipo,
  actualizarTipoEquipo,
  eliminarTipoEquipo,
  obtenerCamposTipoEquipo,
  sincronizarCamposTipoEquipo,
  // Fields
  obtenerCampos,
  crearCampo,
  actualizarCampo,
  eliminarCampo,
  // Departments
  obtenerDepartamentosEquipo,
  crearDepartamentoEquipo,
  actualizarDepartamentoEquipo,
  eliminarDepartamentoEquipo,
  // Bitacoras
  getBitacoras,
  getBitacoraById,
  crearBitacora,
  actualizarBitacora,
  eliminarBitacora,
  getVisitasProgramadas,
  crearVisitaProgramada,
  eliminarVisitaProgramada,
  // Tickets
  getTickets,
  getTicketById,
  crearTicket,
  actualizarTicket,
  eliminarTicket,
  // Notifications
  getNotificaciones,
  marcarNotificacionesLeidas,
  // Projects
  getProyectos,
  getProyecto,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  agregarAdjuntosProyecto,
  agregarBitacorasAProyecto,
  removerBitacoraDeProyecto,
  eliminarProyectoAdjunto,
  // Vehicles
  getVehiculos,
  getVehiculo,
  crearVehiculo,
  actualizarVehiculo,
  eliminarVehiculo,
  crearVehiculoSalida,
  actualizarVehiculoSalida,
  eliminarVehiculoSalida,
  eliminarVehiculoSalidaAdjunto,
  // Documents
  getDocumentacionClientes,
  crearDocumentoCliente,
  eliminarDocumentoCliente,
  // Logs & Utils
  getLogs,
  generarUrl,
} from "../controller/apiController.js";
