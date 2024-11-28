import Cliente from "./Cliente.js";
import Cuenta from "./Cuenta.js";
import UsuarioAsignado from "./UsuarioAsignado.js";
import Equipo from "./Equipo.js";

// Modelo de Cliente
const ClienteModel = Cliente;
// Modelo de Usuario (Técnicos)
const CuentaModel = Cuenta;
// Modelo de Equipamiento de un Cliente
const EquipoModel = Equipo;
// Modelo de Usuarios Asignados a un Equipamiento
const UsuarioAsignadoModel = UsuarioAsignado;

// ClienteModel.belongsTo(CuentaModel, { foreignKey: 'cuentaTecnicoId' });

EquipoModel.belongsTo(ClienteModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' });
ClienteModel.hasMany(EquipoModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' });

// EquipoModel.hasMany(UsuarioAsignadoModel, { foreignKey: 'equipamientoId', onDelete: 'CASCADE' });
// UsuarioAsignadoModel.belongsTo(EquipoModel, { foreignKey: 'equipamientoId', onDelete: 'CASCADE' });

export {
    ClienteModel,
    CuentaModel,
    EquipoModel,
    UsuarioAsignadoModel
}