import Cuenta from "./Cuenta.js";
import EstadoCuenta from "./EstadoCuenta.js";
import TipoCuenta from "./TipoCuenta.js";
import CuentaCasaMatriz from "./CuentaCasaMatriz.js";

import CasaMatriz from "./CasaMatriz.js";
import Sucursal from "./Sucursal.js";

import Equipo from "./Equipo.js";
import Observacion from "./Observacion.js";
import TipoEquipo from "./TipoEquipo.js";
import TipoEquipoCampo from "./TipoEquipoCampo.js";
import Campo from "./Campos.js";
import Bitacora from "./Bitacora.js";
import DepartamentoEquipo from "./DepartamentoEquipo.js";
import Proyecto from "./Proyecto.js";
import ProyectoAdjunto from "./ProyectoAdjunto.js";
import Vehiculo from "./Vehiculo.js";
import VehiculoSalida from "./VehiculoSalida.js";
import VehiculoSalidaAdjunto from "./VehiculoSalidaAdjunto.js";
import VehiculoSalidaTecnico from "./VehiculoSalidaTecnico.js";
import Notificacion from "./Notificacion.js";
import ClienteDocumento from "./ClienteDocumento.js";
import Ticket from "./Ticket.js";
import LogSistema from "./LogSistema.js";
import MensajeTicket from "./MensajeTicket.js";
import ActividadTicket from "./ActividadTicket.js";

//?estado de equipos
import EstadoEquipo from "./EstadoEquipo.js";

//?estado de sucursales
import EstadoSucursal from "./EstadoSucursal.js";

// Visitas programadas
import VisitaProgramada from "./VisitaProgramada.js";

// Modelo de Tipo de Cuentas
const CuentaModel = Cuenta;
// Modelo de los estados de la cuenta
const EstadoCuentaModel = EstadoCuenta;
// Modelo de Usuario (Técnicos, Mesa Ayuda)
const TipoCuentaModel = TipoCuenta;
// Modelo pivote Cuenta - Casa Matriz
const CuentaCasaMatrizModel = CuentaCasaMatriz;

// Modelo de Cliente
const CasaMatrizModel = CasaMatriz;
// Modelo de Sucursal
const SucursalModel = Sucursal;

// Modelo de Equipamiento de un Cliente
const EquipoModel = Equipo;
// Modelo de Observaciones de los Equipos
const ObservacionModel = Observacion;
// Modelo de Tipo de Equipo
const TipoEquipoModel = TipoEquipo;
// Modelo de Campos
const CampoModel = Campo;
// Modelo de Tipo Equipo Campo
const TipoEquipoCampoModel = TipoEquipoCampo;
// Modelo de Departamentos de Equipos
const DepartamentoEquipoModel = DepartamentoEquipo;
// Modelo de Proyectos
const ProyectoModel = Proyecto;
// Modelo de adjuntos de proyectos
const ProyectoAdjuntoModel = ProyectoAdjunto;
const VehiculoModel = Vehiculo;
const VehiculoSalidaModel = VehiculoSalida;
const VehiculoSalidaAdjuntoModel = VehiculoSalidaAdjunto;
const VehiculoSalidaTecnicoModel = VehiculoSalidaTecnico;
const NotificacionModel = Notificacion;
const ClienteDocumentoModel = ClienteDocumento;

//?estado de equipos
const EstadoEquipoModel = EstadoEquipo;

//?estado de sucursales
const EstadoSucursalModel = EstadoSucursal;

// Modelo de Bitacoras
const BitacoraModel = Bitacora;
// Modelo de Tickets
const TicketModel = Ticket;

// Modelo de Visitas Programadas
const VisitaProgramadaModel = VisitaProgramada;

// Modelo de Logs de Sistema
const LogSistemaModel = LogSistema;

// Modelos de Chat de Tickets
const MensajeTicketModel = MensajeTicket;
const ActividadTicketModel = ActividadTicket;

// Relaciones Proyectos
ProyectoModel.belongsTo(CuentaModel, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});
ProyectoModel.belongsTo(CuentaModel, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
CuentaModel.hasMany(ProyectoModel, {
  foreignKey: "creadoPorId",
  as: "proyectosCreados",
});
CuentaModel.hasMany(ProyectoModel, {
  foreignKey: "actualizadoPorId",
  as: "proyectosActualizados",
});

ProyectoModel.hasMany(ProyectoAdjuntoModel, {
  foreignKey: "proyectoId",
  as: "adjuntos",
  onDelete: "CASCADE",
  hooks: true,
});
ProyectoAdjuntoModel.belongsTo(ProyectoModel, {
  foreignKey: "proyectoId",
  as: "proyecto",
  onDelete: "CASCADE",
});

ProyectoAdjuntoModel.belongsTo(CuentaModel, {
  foreignKey: "subidoPorId",
  as: "subidoPor",
  onDelete: "SET NULL",
});
CuentaModel.hasMany(ProyectoAdjuntoModel, {
  foreignKey: "subidoPorId",
  as: "proyectoAdjuntosSubidos",
});

// Relacion que un Tipo de Cuenta pertenece a una Cuenta
CuentaModel.belongsTo(TipoCuentaModel, {
  foreignKey: "tipoCuentaId",
  as: "tipoCuenta",
});
TipoCuentaModel.hasMany(CuentaModel, {
  foreignKey: "tipoCuentaId",
  as: "cuentas",
});

// Relacion muchos a muchos entre Cuenta y Casa Matriz (clientes autorizados)
CuentaModel.belongsToMany(CasaMatrizModel, {
  through: CuentaCasaMatrizModel,
  foreignKey: "cuentaId",
  otherKey: "casaMatrizId",
  as: "clientesAutorizados",
});
CasaMatrizModel.belongsToMany(CuentaModel, {
  through: CuentaCasaMatrizModel,
  foreignKey: "casaMatrizId",
  otherKey: "cuentaId",
  as: "cuentasAsociadas",
});

// Relacion
CuentaModel.belongsTo(EstadoCuentaModel, {
  foreignKey: "estadoCuentaId",
  as: "estadoCuenta",
});
EstadoCuentaModel.hasMany(CuentaModel, {
  foreignKey: "estadoCuentaId",
  as: "estadoCuentas",
});

// Relacion de un Equipo pertenece a una Casa Matriz
EquipoModel.belongsTo(CasaMatrizModel, {
  foreignKey: "casaMatrizId",
  as: "casaMatriz",
  onDelete: "CASCADE",
});
CasaMatrizModel.hasMany(EquipoModel, {
  foreignKey: "casaMatrizId",
  as: "equipos",
  onDelete: "CASCADE",
});

// Relacion que una Sucursal pertenece a una Casa Matriz
SucursalModel.belongsTo(CasaMatrizModel, {
  foreignKey: "casaMatrizId",
  as: "casaMatriz",
  onDelete: "CASCADE",
});
CasaMatrizModel.hasMany(SucursalModel, {
  foreignKey: "casaMatrizId",
  as: "sucursales",
  onDelete: "CASCADE",
});

// Relación Sucursal - EstadoSucursal
SucursalModel.belongsTo(EstadoSucursalModel, {
  foreignKey: "estado",
  as: "estadoSucursal",
});
EstadoSucursalModel.hasMany(SucursalModel, {
  foreignKey: "estado",
  as: "sucursales",
});

// Relacion que un Equipo pertenece a una Sucursal
EquipoModel.belongsTo(SucursalModel, {
  foreignKey: "sucursalId",
  as: "sucursal",
  onDelete: "CASCADE",
});
SucursalModel.hasMany(EquipoModel, {
  foreignKey: "sucursalId",
  as: "equipos",
  onDelete: "CASCADE",
});

// Relacion Bitacora - Casa Matriz
BitacoraModel.belongsTo(CasaMatrizModel, {
  foreignKey: "casaMatrizId",
  as: "casaMatriz",
  onDelete: "CASCADE",
});
CasaMatrizModel.hasMany(BitacoraModel, {
  foreignKey: "casaMatrizId",
  as: "bitacoras",
  onDelete: "CASCADE",
});

// Relacion Bitacora - Sucursal
BitacoraModel.belongsTo(SucursalModel, {
  foreignKey: "sucursalId",
  as: "sucursal",
  onDelete: "SET NULL",
});
SucursalModel.hasMany(BitacoraModel, {
  foreignKey: "sucursalId",
  as: "bitacoras",
  onDelete: "SET NULL",
});

// Relacion Bitacora - Usuario (creador/actualizador)
BitacoraModel.belongsTo(CuentaModel, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});
BitacoraModel.belongsTo(CuentaModel, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
BitacoraModel.belongsTo(ProyectoModel, {
  foreignKey: "proyectoId",
  as: "proyecto",
  onDelete: "SET NULL",
});
CuentaModel.hasMany(BitacoraModel, {
  foreignKey: "creadoPorId",
  as: "bitacorasCreadas",
});
CuentaModel.hasMany(BitacoraModel, {
  foreignKey: "actualizadoPorId",
  as: "bitacorasActualizadas",
});
ProyectoModel.hasMany(BitacoraModel, {
  foreignKey: "proyectoId",
  as: "bitacoras",
  onDelete: "SET NULL",
});

// Relaciones Tickets
TicketModel.belongsTo(CasaMatrizModel, {
  foreignKey: "casaMatrizId",
  as: "casaMatriz",
  onDelete: "CASCADE",
});
CasaMatrizModel.hasMany(TicketModel, {
  foreignKey: "casaMatrizId",
  as: "tickets",
  onDelete: "CASCADE",
});

TicketModel.belongsTo(SucursalModel, {
  foreignKey: "sucursalId",
  as: "sucursal",
  onDelete: "SET NULL",
});
SucursalModel.hasMany(TicketModel, {
  foreignKey: "sucursalId",
  as: "tickets",
  onDelete: "SET NULL",
});

TicketModel.belongsTo(CuentaModel, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});
TicketModel.belongsTo(CuentaModel, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
TicketModel.belongsTo(CuentaModel, {
  foreignKey: "tecnicoAsignadoId",
  as: "tecnicoAsignado",
});
TicketModel.belongsTo(ProyectoModel, {
  foreignKey: "proyectoId",
  as: "proyecto",
  onDelete: "SET NULL",
});
CuentaModel.hasMany(TicketModel, {
  foreignKey: "creadoPorId",
  as: "ticketsCreados",
});
CuentaModel.hasMany(TicketModel, {
  foreignKey: "actualizadoPorId",
  as: "ticketsActualizados",
});
CuentaModel.hasMany(TicketModel, {
  foreignKey: "tecnicoAsignadoId",
  as: "ticketsAsignados",
});
ProyectoModel.hasMany(TicketModel, {
  foreignKey: "proyectoId",
  as: "tickets",
  onDelete: "SET NULL",
});

// Relacion Documentos - Casa Matriz/Cuenta
ClienteDocumentoModel.belongsTo(CasaMatrizModel, {
  foreignKey: "casaMatrizId",
  as: "casaMatriz",
  onDelete: "CASCADE",
});
CasaMatrizModel.hasMany(ClienteDocumentoModel, {
  foreignKey: "casaMatrizId",
  as: "documentos",
  onDelete: "CASCADE",
});
ClienteDocumentoModel.belongsTo(CuentaModel, {
  foreignKey: "subidoPorId",
  as: "subidoPor",
  onDelete: "SET NULL",
});
CuentaModel.hasMany(ClienteDocumentoModel, {
  foreignKey: "subidoPorId",
  as: "documentosSubidos",
});

// Relaciones Visita Programada
VisitaProgramadaModel.belongsTo(CasaMatrizModel, {
  foreignKey: "casaMatrizId",
  as: "casaMatriz",
  onDelete: "CASCADE",
});
CasaMatrizModel.hasMany(VisitaProgramadaModel, {
  foreignKey: "casaMatrizId",
  as: "visitasProgramadas",
  onDelete: "CASCADE",
});

VisitaProgramadaModel.belongsTo(SucursalModel, {
  foreignKey: "sucursalId",
  as: "sucursal",
  onDelete: "SET NULL",
});
SucursalModel.hasMany(VisitaProgramadaModel, {
  foreignKey: "sucursalId",
  as: "visitasProgramadas",
  onDelete: "SET NULL",
});

VisitaProgramadaModel.belongsTo(CuentaModel, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});
VisitaProgramadaModel.belongsTo(CuentaModel, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
CuentaModel.hasMany(VisitaProgramadaModel, {
  foreignKey: "creadoPorId",
  as: "visitasProgramadasCreadas",
});
CuentaModel.hasMany(VisitaProgramadaModel, {
  foreignKey: "actualizadoPorId",
  as: "visitasProgramadasActualizadas",
});

// Relaciones Vehiculos
VehiculoModel.hasMany(VehiculoSalidaModel, {
  foreignKey: "vehiculoId",
  as: "salidas",
  onDelete: "CASCADE",
  hooks: true,
});
VehiculoSalidaModel.belongsTo(VehiculoModel, {
  foreignKey: "vehiculoId",
  as: "vehiculo",
  onDelete: "CASCADE",
});

VehiculoSalidaModel.belongsToMany(CuentaModel, {
  through: VehiculoSalidaTecnicoModel,
  foreignKey: "vehiculoSalidaId",
  otherKey: "tecnicoId",
  as: "tecnicos",
});
CuentaModel.belongsToMany(VehiculoSalidaModel, {
  through: VehiculoSalidaTecnicoModel,
  foreignKey: "tecnicoId",
  otherKey: "vehiculoSalidaId",
  as: "vehiculoSalidas",
});

// Relaciones Notificaciones
NotificacionModel.belongsTo(CuentaModel, {
  foreignKey: "cuentaId",
  as: "destinatario",
  onDelete: "CASCADE",
});
CuentaModel.hasMany(NotificacionModel, {
  foreignKey: "cuentaId",
  as: "notificaciones",
  onDelete: "CASCADE",
});

VehiculoSalidaModel.hasMany(VehiculoSalidaAdjuntoModel, {
  foreignKey: "vehiculoSalidaId",
  as: "adjuntos",
  onDelete: "CASCADE",
  hooks: true,
});
VehiculoSalidaAdjuntoModel.belongsTo(VehiculoSalidaModel, {
  foreignKey: "vehiculoSalidaId",
  as: "salida",
  onDelete: "CASCADE",
});

// Relación Equipo - TipoEquipo (uno a muchos)
EquipoModel.belongsTo(TipoEquipoModel, {
  foreignKey: "tipoEquipoId",
  as: "tipoEquipo",
});
TipoEquipoModel.hasMany(EquipoModel, {
  foreignKey: "tipoEquipoId",
  as: "equipos",
});

// Relación Observación - Equipo
ObservacionModel.belongsTo(EquipoModel, {
  foreignKey: "equipoId",
  as: "equipo",
});
EquipoModel.hasMany(ObservacionModel, {
  foreignKey: "equipoId",
  as: "observaciones",
});

// Relación TipoEquipo - Campo (muchos a muchos)
TipoEquipoCampoModel.belongsTo(TipoEquipoModel, {
  foreignKey: "tipoEquipoId",
  as: "tipoEquipo",
});
TipoEquipoCampoModel.belongsTo(CampoModel, {
  foreignKey: "campoId",
  as: "campo",
});
CampoModel.hasMany(TipoEquipoCampoModel, {
  foreignKey: "campoId",
  as: "tipoEquipoCampos",
});
TipoEquipoModel.hasMany(TipoEquipoCampoModel, {
  foreignKey: "tipoEquipoId",
  as: "tipoEquipoCampos",
});

// Relacion LogSistema - Usuario
LogSistemaModel.belongsTo(CuentaModel, {
  foreignKey: "usuarioId",
  as: "usuario",
});
CuentaModel.hasMany(LogSistemaModel, { foreignKey: "usuarioId", as: "logs" });

// Relaciones MensajeTicket
MensajeTicketModel.belongsTo(TicketModel, {
  foreignKey: "ticketId",
  as: "ticket",
  onDelete: "CASCADE",
});
TicketModel.hasMany(MensajeTicketModel, {
  foreignKey: "ticketId",
  as: "mensajes",
  onDelete: "CASCADE",
});
MensajeTicketModel.belongsTo(CuentaModel, {
  foreignKey: "cuentaId",
  as: "remitente",
});
CuentaModel.hasMany(MensajeTicketModel, {
  foreignKey: "cuentaId",
  as: "mensajesEnviados",
});

// Relaciones ActividadTicket
ActividadTicketModel.belongsTo(TicketModel, {
  foreignKey: "ticketId",
  as: "ticket",
  onDelete: "CASCADE",
});
TicketModel.hasMany(ActividadTicketModel, {
  foreignKey: "ticketId",
  as: "actividades",
  onDelete: "CASCADE",
});
ActividadTicketModel.belongsTo(CuentaModel, {
  foreignKey: "cuentaId",
  as: "realizadoPor",
});
CuentaModel.hasMany(ActividadTicketModel, {
  foreignKey: "cuentaId",
  as: "actividadesRealizadas",
});

export {
  CuentaModel,
  TipoCuentaModel,
  EstadoCuentaModel,
  CuentaCasaMatrizModel,
  CasaMatrizModel,
  SucursalModel,
  EquipoModel,
  ObservacionModel,
  TipoEquipoModel,
  CampoModel,
  TipoEquipoCampoModel,
  DepartamentoEquipoModel,
  //?estado de equipos
  EstadoEquipoModel,
  //?estado de sucursales
  EstadoSucursalModel,
  BitacoraModel,
  TicketModel,
  VisitaProgramadaModel,
  ProyectoModel,
  ProyectoAdjuntoModel,
  VehiculoModel,
  VehiculoSalidaModel,
  VehiculoSalidaAdjuntoModel,
  VehiculoSalidaTecnicoModel,
  NotificacionModel,
  ClienteDocumentoModel,
  LogSistemaModel,
  MensajeTicketModel,
  ActividadTicketModel,
};
