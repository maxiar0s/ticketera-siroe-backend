import Cuenta from "./Cuenta.js";
import TipoCuenta from "./TipoCuenta.js";

import CasaMatriz from "./CasaMatriz.js";
import Sucursal from './Sucursal.js';

import Equipo from "./Equipo.js";
import TipoEquipo from './TipoEquipo.js'
import TipoEquipoCampo from "./TipoEquipoCampo.js";
import Campo from "./Campos.js";

// Modelo de Tipo de Cuentas
const CuentaModel = Cuenta;
// Modelo de Usuario (Técnicos, Mesa Ayuda)
const TipoCuentaModel = TipoCuenta;

// Modelo de Cliente
const CasaMatrizModel = CasaMatriz;
// Modelo de Sucursal
const SucursalModel = Sucursal;

// Modelo de Equipamiento de un Cliente
const EquipoModel = Equipo;
// Modelo de Tipo de Equipo
const TipoEquipoModel = TipoEquipo;
// Modelo de Campos
const CampoModel = Campo;
// Modelo de Tipo Equipo Campo
const TipoEquipoCampoModel = TipoEquipoCampo

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


// Relación Equipo - TipoEquipo (uno a muchos)
EquipoModel.belongsTo(TipoEquipoModel, { foreignKey: 'tipoEquipoId', as: 'tipoEquipo' });
TipoEquipoModel.hasMany(EquipoModel, { foreignKey: 'tipoEquipoId', as: 'equipos' });

// Relación TipoEquipo - Campo (muchos a muchos)
TipoEquipoCampoModel.belongsTo(TipoEquipoModel, { foreignKey: 'tipoEquipoId', as: 'tipoEquipo' });
TipoEquipoCampoModel.belongsTo(CampoModel, { foreignKey: 'campoId', as: 'campo' });

CampoModel.hasMany(TipoEquipoCampoModel, { foreignKey: 'campoId', as: 'tipoEquipoCampos' });
TipoEquipoModel.hasMany(TipoEquipoCampoModel, { foreignKey: 'tipoEquipoId', as: 'tipoEquipoCampos' });

export {
    CuentaModel,
    TipoCuentaModel,
    
    CasaMatrizModel,
    SucursalModel,
    
    EquipoModel,
    TipoEquipoModel,
    CampoModel,
    TipoEquipoCampoModel,
}