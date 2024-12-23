import CasaMatriz from "./CasaMatriz.js";
import Cuenta from "./Cuenta.js";
import Equipo from "./Equipo.js";
import Sucursal from './Sucursal.js';
import tipoCuenta from "./TipoCuenta.js";

// Modelo de Cliente
const CasaMatrizModel = CasaMatriz;
// Modelo de Usuario (Técnicos, Mesa Ayuda)
const CuentaModel = Cuenta;
// Modelo de Tipo de Cuentas
const TipoCuentaModel = tipoCuenta;
// Modelo de Equipamiento de un Cliente
const EquipoModel = Equipo;
// Modelo de Sucursal
const SucursalModel = Sucursal;

// Relacion que un Tipo de Cuenta pertenece a una Cuenta
CuentaModel.belongsTo(TipoCuentaModel, { foreignKey: 'tipoCuentaId', as:'tipoCuenta' });
TipoCuentaModel.hasMany(CuentaModel, { foreignKey: 'tipoCuentaId', as: 'cuentas' });

// Relacion de un Equipo pertenece a una Casa Matriz
EquipoModel.belongsTo(CasaMatrizModel, { foreignKey: 'casaMatrizId', as: 'casaMatriz', onDelete: 'CASCADE' });
CasaMatrizModel.hasMany(EquipoModel, { foreignKey: 'casaMatrizId', as: 'equipos', onDelete: 'CASCADE' });

// Relacion que una Sucursal pertenece a una Casa Matriz
SucursalModel.belongsTo(CasaMatrizModel, { foreignKey: 'casaMatrizId', as: 'casaMatriz', onDelete: 'CASCADE' })
CasaMatrizModel.hasMany(SucursalModel, { foreignKey: 'casaMatrizId', as: 'sucursales', onDelete: 'CASCADE' })

// Relacion que un Equipo pertenece a una Sucursal
EquipoModel.belongsTo(SucursalModel, { foreignKey: 'sucursalId', as: 'sucursal', onDelete: 'CASCADE' });
SucursalModel.hasMany(EquipoModel, { foreignKey: 'sucursalId', as: 'equipos', onDelete: 'CASCADE' });

export {
    CasaMatrizModel,
    CuentaModel,
    EquipoModel,
    TipoCuentaModel,
    SucursalModel,
}