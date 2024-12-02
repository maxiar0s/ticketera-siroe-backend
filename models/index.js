import Cliente from "./Cliente.js";
import Cuenta from "./Cuenta.js";
import UsuarioAsignado from "./UsuarioAsignado.js";
import Equipo from "./Equipo.js";
import Sucursal from './Sucursal.js'

// Modelo de Cliente
const ClienteModel = Cliente;
// Modelo de Usuario (Técnicos)
const CuentaModel = Cuenta;
// Modelo de Equipamiento de un Cliente
const EquipoModel = Equipo;
// Modelo de Usuarios Asignados a un Equipamiento
const UsuarioAsignadoModel = UsuarioAsignado;
// Modelo de Sucursal
const SucursalModel = Sucursal;

// ClienteModel.belongsTo(CuentaModel, { foreignKey: 'cuentaTecnicoId' });

EquipoModel.belongsTo(ClienteModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' });
ClienteModel.hasMany(EquipoModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' });

SucursalModel.belongsTo(ClienteModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' })
ClienteModel.hasMany(SucursalModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' })

EquipoModel.belongsTo(SucursalModel, { foreignKey: 'sucursalId', onDelete: 'CASCADE' });
SucursalModel.hasMany(EquipoModel, { foreignKey: 'sucursalId', onDelete: 'CASCADE' });

// EquipoModel.hasMany(UsuarioAsignadoModel, { foreignKey: 'equipamientoId', onDelete: 'CASCADE' });
// UsuarioAsignadoModel.belongsTo(EquipoModel, { foreignKey: 'equipamientoId', onDelete: 'CASCADE' });

export {
    ClienteModel,
    CuentaModel,
    EquipoModel,
    UsuarioAsignadoModel,
    SucursalModel
}