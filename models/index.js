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
// CuentaModel.belongsTo(ClienteModel, { foreignKey: 'clienteId' });

EquipamientoModel.belongsTo(ClienteModel, { foreignKey: 'clienteId' });
// ClienteModel.belongsTo(EquipamientoModel, { foreignKey: 'EquipamientoId' });

UsuarioAsignadoModel.belongsTo(EquipamientoModel, { foreignKey: 'equipamientoId' });
// EquipamientoModel.belongsTo(UsuarioAsignadoModel, { foreignKey: 'UsuarioAsignadoId' });

export {
    ClienteModel,
    CuentaModel,
    EquipamientoModel,
    UsuarioAsignadoModel
}