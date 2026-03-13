import { exit } from 'node:process';
import bcrypt from 'bcrypt';

import db from '../config/db.js';
import { ensureTicketCreatorEmailColumn } from '../scripts/ensure-ticket-creator-email.js';
import { ensureInventarioModule } from '../scripts/add-inventario-module.js';
import {
  CampoModel,
  CasaMatrizModel,
  CuentaCasaMatrizModel,
  CuentaModel,
  DepartamentoEquipoModel,
  EquipoModel,
  EstadoCuentaModel,
  EstadoEquipoModel,
  EstadoSucursalModel,
  SucursalModel,
  TipoCuentaModel,
  TipoEquipoCampoModel,
  TipoEquipoModel,
} from '../models/index.js';

import Campos from './Campo.js';
import TipoCuentas from './TipoCuenta.js';
import estadoCuenta from './EstadoCuenta.js';
import TipoEquipo from './TipoEquipo.js';
import TipoEquipoCampo from './TipoEquipoCampo.js';
import EstadosEquipo from './EstadoEquipo.js';
import EstadosSucursal from './EstadoSucursal.js';
import {
  casasMatricesDemo,
  sucursalesDemo,
  cuentasDemo,
  cuentaCasaMatrizDemo,
  equiposDemo,
} from './demo/demoData.js';

const crearMapaDesdeRegistros = (registros = [], campoNombre = 'name') => {
  const mapa = new Map();
  registros.forEach((registro) => {
    mapa.set(`${registro[campoNombre]}`.trim().toLowerCase(), registro.id);
  });
  return mapa;
};

const importarDatosDemo = async () => {
  try {
    await db.authenticate();
    await db.sync({ force: true });
    await ensureTicketCreatorEmailColumn({ runBackfill: false });
    await ensureInventarioModule();

    await Promise.all([
      EstadoCuentaModel.bulkCreate(estadoCuenta),
      TipoCuentaModel.bulkCreate(TipoCuentas),
      CampoModel.bulkCreate(Campos),
      TipoEquipoModel.bulkCreate(TipoEquipo),
    ]);

    await Promise.all([
      TipoEquipoCampoModel.bulkCreate(TipoEquipoCampo),
      EstadoEquipoModel.bulkCreate(EstadosEquipo),
      EstadoSucursalModel.bulkCreate(EstadosSucursal),
    ]);

    await CasaMatrizModel.bulkCreate(casasMatricesDemo);

    const estadosSucursal = await EstadoSucursalModel.findAll({
      attributes: ['id', 'name'],
      raw: true,
    });
    const mapaEstadoSucursal = crearMapaDesdeRegistros(estadosSucursal);

    const sucursalesNormalizadas = sucursalesDemo.map((sucursal) => {
      const estadoId = mapaEstadoSucursal.get(
        sucursal.estadoNombre.trim().toLowerCase(),
      );
      if (!estadoId) {
        throw new Error(
          `No pude encontrar el estado "${sucursal.estadoNombre}" para la sucursal ${sucursal.sucursal}`,
        );
      }

      const { estadoNombre, ...resto } = sucursal;
      return {
        ...resto,
        estado: estadoId,
      };
    });

    await SucursalModel.bulkCreate(sucursalesNormalizadas);

    const [tiposCuentaReg, estadosCuentaReg] = await Promise.all([
      TipoCuentaModel.findAll({ attributes: ['id', 'name'], raw: true }),
      EstadoCuentaModel.findAll({ attributes: ['id', 'name'], raw: true }),
    ]);

    const mapaTipoCuenta = crearMapaDesdeRegistros(tiposCuentaReg);
    const mapaEstadoCuenta = crearMapaDesdeRegistros(estadosCuentaReg);

    const cuentasNormalizadas = cuentasDemo.map((cuenta) => {
      const tipoId = mapaTipoCuenta.get(cuenta.tipoCuenta.trim().toLowerCase());
      const estadoId = mapaEstadoCuenta.get(
        cuenta.estadoCuenta.trim().toLowerCase(),
      );

      if (!tipoId) {
        throw new Error(
          `No se encontró el tipo de cuenta "${cuenta.tipoCuenta}"`,
        );
      }
      if (!estadoId) {
        throw new Error(
          `No se encontró el estado de cuenta "${cuenta.estadoCuenta}"`,
        );
      }

      return {
        name: cuenta.name,
        telefono: cuenta.telefono,
        email: cuenta.email,
        password: bcrypt.hashSync(cuenta.password, 10),
        tipoCuentaId: tipoId,
        estadoCuentaId: estadoId,
        esTecnico: cuenta.esTecnico ?? false,
        haveTickets: cuenta.haveTickets ?? false,
      };
    });

    await CuentaModel.bulkCreate(cuentasNormalizadas);

    const cuentas = await CuentaModel.findAll({
      attributes: ['id', 'email'],
      raw: true,
    });
    const mapaCuentaPorEmail = new Map(
      cuentas.map((cuenta) => [cuenta.email.toLowerCase(), cuenta.id]),
    );

    const vinculaciones = cuentaCasaMatrizDemo
      .map((relacion) => {
        const cuentaId = mapaCuentaPorEmail.get(relacion.email.toLowerCase());
        if (!cuentaId) {
          return null;
        }
        return {
          cuentaId,
          casaMatrizId: relacion.casaMatrizId,
        };
      })
      .filter(Boolean);

    if (vinculaciones.length) {
      await CuentaCasaMatrizModel.bulkCreate(vinculaciones);
    }

    const [estadosEquipoReg, tiposEquipoReg] = await Promise.all([
      EstadoEquipoModel.findAll({ attributes: ['id', 'name'], raw: true }),
      TipoEquipoModel.findAll({ attributes: ['id', 'name'], raw: true }),
    ]);
    const mapaEstadoEquipo = crearMapaDesdeRegistros(estadosEquipoReg);
    const mapaTipoEquipo = crearMapaDesdeRegistros(tiposEquipoReg);

    const equiposNormalizados = equiposDemo.map((equipo) => {
      const estadoId = mapaEstadoEquipo.get(equipo.estado.trim().toLowerCase());
      const tipoId = mapaTipoEquipo.get(
        equipo.tipoEquipo.trim().toLowerCase(),
      );

      if (!estadoId) {
        throw new Error(`Estado de equipo desconocido: ${equipo.estado}`);
      }
      if (!tipoId) {
        throw new Error(`Tipo de equipo desconocido: ${equipo.tipoEquipo}`);
      }

      const { estado, tipoEquipo, ...resto } = equipo;
      return {
        ...resto,
        estado: estadoId,
        tipoEquipoId: tipoId,
      };
    });

    await EquipoModel.bulkCreate(equiposNormalizados);

    const departamentos = [
      ...new Set(
        equiposDemo
          .map((equipo) => equipo.departamento)
          .filter((nombre) => !!nombre),
      ),
    ];

    if (departamentos.length) {
      await DepartamentoEquipoModel.bulkCreate(
        departamentos.map((name) => ({ name })),
        { ignoreDuplicates: true },
      );
    }

    console.log('✅ Datos demo importados correctamente.');
    exit(0);
  } catch (error) {
    console.error('❌ Error al importar los datos demo:', error);
    exit(1);
  }
};

if (process.argv[2] === '-d') {
  importarDatosDemo();
} else {
  console.log('Agrega el flag "-d" para ejecutar el importador de datos demo.');
  exit(0);
}
