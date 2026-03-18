import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { DataTypes } from "sequelize";

import db from "../config/db.js";
import {
  CasaMatrizModel,
  CuentaModel,
  EstadoCuentaModel,
  TipoCuentaModel,
} from "../models/index.js";

const TABLE_NAME = "Tickets";
const UNIQUE_INDEX_NAME = "tickets_cotizacion_id_unique";

export const DEFAULT_COTIZADOR_CASA_MATRIZ_ID = "cotizador-ticketera";
export const DEFAULT_COTIZADOR_CASA_MATRIZ_NOMBRE = "Ticketera";
export const DEFAULT_COTIZADOR_ACCOUNT_EMAIL = "cotizador.integracion@local.siroe";
export const DEFAULT_COTIZADOR_ACCOUNT_NAME = "Integracion Cotizador";

const getConfiguredCasaMatrizId = () =>
  process.env.COTIZADOR_DEFAULT_CASA_MATRIZ_ID || DEFAULT_COTIZADOR_CASA_MATRIZ_ID;

const getConfiguredCasaMatrizNombre = () =>
  process.env.COTIZADOR_DEFAULT_CASA_MATRIZ_NAME || DEFAULT_COTIZADOR_CASA_MATRIZ_NOMBRE;

const getConfiguredAccountEmail = () =>
  (process.env.COTIZADOR_INTEGRATION_ACCOUNT_EMAIL || DEFAULT_COTIZADOR_ACCOUNT_EMAIL).trim().toLowerCase();

const getConfiguredAccountName = () =>
  (process.env.COTIZADOR_INTEGRATION_ACCOUNT_NAME || DEFAULT_COTIZADOR_ACCOUNT_NAME).trim();

const getConfiguredAccountPhone = () => {
  const value = Number.parseInt(process.env.COTIZADOR_INTEGRATION_ACCOUNT_PHONE || "0", 10);
  return Number.isInteger(value) && value >= 0 ? value : 0;
};

const getConfiguredPassword = () =>
  process.env.COTIZADOR_INTEGRATION_ACCOUNT_PASSWORD || crypto.randomUUID();

async function ensureColumn(queryInterface, tableDefinition, columnName, definition) {
  if (tableDefinition[columnName]) {
    console.log(`La columna ${columnName} ya existe en ${TABLE_NAME}.`);
    return;
  }

  await queryInterface.addColumn(TABLE_NAME, columnName, definition);
  console.log(`Columna ${columnName} agregada en ${TABLE_NAME}.`);
}

async function ensureUniqueCotizacionIndex() {
  const [rows] = await db.query(`SHOW INDEX FROM \`${TABLE_NAME}\` WHERE Key_name = '${UNIQUE_INDEX_NAME}'`);
  if (Array.isArray(rows) && rows.length > 0) {
    console.log(`Indice ${UNIQUE_INDEX_NAME} ya existe en ${TABLE_NAME}.`);
    return;
  }

  await db.query(`
    ALTER TABLE \`${TABLE_NAME}\`
    ADD UNIQUE INDEX \`${UNIQUE_INDEX_NAME}\` (\`cotizacionId\`);
  `);
  console.log(`Indice ${UNIQUE_INDEX_NAME} creado en ${TABLE_NAME}.`);
}

export const ensureCotizadorIntegrationTicketColumns = async () => {
  const queryInterface = db.getQueryInterface();
  const tableDefinition = await queryInterface.describeTable(TABLE_NAME);

  await ensureColumn(queryInterface, tableDefinition, "cotizacionId", {
    type: DataTypes.STRING,
    allowNull: true,
  });
  await ensureColumn(queryInterface, tableDefinition, "cotizacionVersion", {
    type: DataTypes.INTEGER,
    allowNull: true,
  });
  await ensureColumn(queryInterface, tableDefinition, "cotizacionUrl", {
    type: DataTypes.STRING,
    allowNull: true,
  });

  await ensureUniqueCotizacionIndex();
};

const getActiveEstadoCuenta = async () => {
  const estado = await EstadoCuentaModel.findOne({
    where: { name: "Activa" },
    order: [["id", "ASC"]],
  });
  if (estado) {
    return estado;
  }
  return EstadoCuentaModel.findOne({ order: [["id", "ASC"]] });
};

const getAdminTipoCuenta = async () => {
  const tipo = await TipoCuentaModel.findOne({
    where: { name: "Administrador" },
    order: [["id", "ASC"]],
  });
  if (tipo) {
    return tipo;
  }
  return TipoCuentaModel.findOne({ order: [["id", "ASC"]] });
};

export const ensureCotizadorCasaMatriz = async () => {
  const configuredId = getConfiguredCasaMatrizId();
  const configuredName = getConfiguredCasaMatrizNombre();

  let casaMatriz = await CasaMatrizModel.findByPk(configuredId);
  if (!casaMatriz) {
    casaMatriz = await CasaMatrizModel.findOne({
      where: { razonSocial: configuredName },
    });
  }

  if (casaMatriz) {
    return casaMatriz;
  }

  return CasaMatrizModel.create({
    id: configuredId,
    razonSocial: configuredName,
    rut: process.env.COTIZADOR_DEFAULT_CASA_MATRIZ_RUT || null,
    correo: process.env.COTIZADOR_DEFAULT_CASA_MATRIZ_EMAIL || null,
    encargadoGeneral: process.env.COTIZADOR_DEFAULT_CASA_MATRIZ_CONTACTO || "Integracion Cotizador",
    telefonoEncargado: getConfiguredAccountPhone(),
    fechaIngreso: new Date(),
    esLead: false,
  });
};

export const ensureCotizadorIntegrationAccount = async () => {
  const email = getConfiguredAccountEmail();
  let cuenta = await CuentaModel.findOne({ where: { email } });
  if (cuenta) {
    return cuenta;
  }

  const [tipoCuenta, estadoCuenta] = await Promise.all([
    getAdminTipoCuenta(),
    getActiveEstadoCuenta(),
  ]);

  if (!tipoCuenta || !estadoCuenta) {
    throw new Error("No fue posible resolver tipo/estado para la cuenta de integracion de Cotizador.");
  }

  const password = await bcrypt.hash(getConfiguredPassword(), 10);
  cuenta = await CuentaModel.create({
    name: getConfiguredAccountName(),
    email,
    telefono: getConfiguredAccountPhone(),
    password,
    tipoCuentaId: tipoCuenta.id,
    estadoCuentaId: estadoCuenta.id,
    haveTickets: true,
    esTecnico: false,
  });

  return cuenta;
};

export const ensureCotizadorIntegrationResources = async () => {
  const [casaMatriz, cuenta] = await Promise.all([
    ensureCotizadorCasaMatriz(),
    ensureCotizadorIntegrationAccount(),
  ]);

  return { casaMatriz, cuenta };
};

export const ensureCotizadorIntegration = async () => {
  await ensureCotizadorIntegrationTicketColumns();
  await ensureCotizadorIntegrationResources();
};
