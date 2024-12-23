import CasaMatriz from "./CasaMatriz.js";
import Cuenta from "./Cuenta.js";
import Equipo from "./Equipo.js";
import Sucursal from './Sucursal.js';
import tipoCuenta from "./TipoCuenta.js";

// Modelo de Cliente
const ClienteModel = CasaMatriz;
// Modelo de Usuario (Técnicos, Mesa Ayuda)
const CuentaModel = Cuenta;
// Modelo de Tipo de Cuentas
const TipoCuentaModel = tipoCuenta;
// Modelo de Equipamiento de un Cliente
const EquipoModel = Equipo;
// Modelo de Sucursal
const SucursalModel = Sucursal;

// Relacion que un Tipo de Cuenta pertenece a una Cuenta
CuentaModel.belongsTo(TipoCuentaModel, { foreignKey: 'tipoCuentaId' })

// Relacion de un Equipo pertenece a una Casa Matriz
EquipoModel.belongsTo(ClienteModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' });
ClienteModel.hasMany(EquipoModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' });

// Relacion que una Sucursal pertenece a una Casa Matriz
SucursalModel.belongsTo(ClienteModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' })
ClienteModel.hasMany(SucursalModel, { foreignKey: 'clienteId', onDelete: 'CASCADE' })

// Relacion que un Equipo pertenece a una Sucursal
EquipoModel.belongsTo(SucursalModel, { foreignKey: 'sucursalId', onDelete: 'CASCADE' });
SucursalModel.hasMany(EquipoModel, { foreignKey: 'sucursalId', onDelete: 'CASCADE' });

export {
    ClienteModel,
    CuentaModel,
    EquipoModel,
    TipoCuentaModel,
    SucursalModel,
}