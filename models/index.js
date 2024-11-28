import Cliente from "./Cliente.js";
import Cuenta from "./Cuenta.js";
import UsuarioAsignado from "./UsuarioAsignado.js";
import Equipamiento from "./Equipamiento.js";

// Modelo de Cliente
const ClienteModel = Cliente;
// Modelo de Usuario (Técnicos)
const CuentaModel = Cuenta;
// Modelo de Equipamiento de un Cliente
const EquipamientoModel = Equipamiento;
// Modelo de Usuarios Asignados a un Equipamiento
const UsuarioAsignadoModel = UsuarioAsignado;

ClienteModel.belongsTo(CuentaModel, { foreignKey: 'cuentaTecnicoId' });

EquipamientoModel.belongsTo(ClienteModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' });
ClienteModel.hasMany(EquipamientoModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' });

// EquipamientoModel.hasMany(UsuarioAsignadoModel, { foreignKey: 'equipamientoId', onDelete: 'CASCADE' });
// UsuarioAsignadoModel.belongsTo(EquipamientoModel, { foreignKey: 'equipamientoId', onDelete: 'CASCADE' });

export {
    ClienteModel,
    CuentaModel,
    EquipamientoModel,
    UsuarioAsignadoModel
}