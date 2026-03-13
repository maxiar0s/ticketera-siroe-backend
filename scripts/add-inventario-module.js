import { DataTypes } from "sequelize";
import db from "../config/db.js";
import "../models/EstadoInventario.js";
import "../models/Inventario.js";

const INVENTARIOS_TABLE = "Inventarios";
const ESTADOS_INVENTARIO_TABLE = "EstadoInventarios";

const ESTADOS_DEFAULT = [
  "Disponible",
  "Arrendado",
  "Defectuoso",
  "Asignado",
];

const ESTADOS_RENOMBRE = {
  "En mantencion": "Defectuoso",
  Baja: "Arrendado",
};

const normalizeTableName = (table) => table.toLowerCase();

const tableExists = async (queryInterface, tableName) => {
  const tables = await queryInterface.showAllTables();
  return tables
    .map((table) =>
      typeof table === "string" ? table : table?.tableName || table?.name
    )
    .filter(Boolean)
    .map(normalizeTableName)
    .includes(normalizeTableName(tableName));
};

const ensureColumn = async (queryInterface, tableName, columnName, definition) => {
  const definitionMap = await queryInterface.describeTable(tableName);
  if (!definitionMap[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
    console.log(`Columna ${columnName} agregada a ${tableName}.`);
  }
};

const ensureIndex = async (queryInterface, tableName, options) => {
  const indexes = await queryInterface.showIndex(tableName);
  const exists = indexes.some((index) => index.name === options.name);
  if (!exists) {
    await queryInterface.addIndex(tableName, { ...options });
    console.log(`Indice ${options.name} creado en ${tableName}.`);
  }
};

const ensureForeignKey = async (
  queryInterface,
  tableName,
  column,
  constraintName,
  references,
  onUpdate = "CASCADE",
  onDelete = "RESTRICT"
) => {
  const existing = await queryInterface.getForeignKeyReferencesForTable(
    tableName
  );
  const hasConstraint = existing.some(
    (reference) =>
      reference.columnName === column || reference.constraintName === constraintName
  );

  if (!hasConstraint) {
    await queryInterface.addConstraint(tableName, {
      fields: [column],
      type: "foreign key",
      name: constraintName,
      references,
      onUpdate,
      onDelete,
    });
    console.log(`Relacion ${constraintName} creada en ${tableName}.`);
  }
};

const ensureEstadosInventarioTable = async (queryInterface) => {
  const exists = await tableExists(queryInterface, ESTADOS_INVENTARIO_TABLE);

  if (!exists) {
    await queryInterface.createTable(ESTADOS_INVENTARIO_TABLE, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
      },
    });
    console.log(`Tabla ${ESTADOS_INVENTARIO_TABLE} creada.`);
  }

  await ensureColumn(queryInterface, ESTADOS_INVENTARIO_TABLE, "name", {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
  });
};

const ensureInventariosTable = async (queryInterface) => {
  const exists = await tableExists(queryInterface, INVENTARIOS_TABLE);

  if (!exists) {
    await queryInterface.createTable(INVENTARIOS_TABLE, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      sku: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      nombre: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      valor: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      estado: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    });
    console.log(`Tabla ${INVENTARIOS_TABLE} creada.`);
  }

  await ensureColumn(queryInterface, INVENTARIOS_TABLE, "sku", {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  });
  await ensureColumn(queryInterface, INVENTARIOS_TABLE, "nombre", {
    type: DataTypes.STRING(255),
    allowNull: false,
  });
  await ensureColumn(queryInterface, INVENTARIOS_TABLE, "descripcion", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await ensureColumn(queryInterface, INVENTARIOS_TABLE, "valor", {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  });
  await ensureColumn(queryInterface, INVENTARIOS_TABLE, "estado", {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  });

  await ensureIndex(queryInterface, INVENTARIOS_TABLE, {
    fields: ["sku"],
    name: "idx_inventarios_sku",
    unique: true,
  });
  await ensureIndex(queryInterface, INVENTARIOS_TABLE, {
    fields: ["nombre"],
    name: "idx_inventarios_nombre",
  });
  await ensureIndex(queryInterface, INVENTARIOS_TABLE, {
    fields: ["estado"],
    name: "idx_inventarios_estado",
  });

  await ensureForeignKey(
    queryInterface,
    INVENTARIOS_TABLE,
    "estado",
    "fk_inventarios_estado",
    { table: ESTADOS_INVENTARIO_TABLE, field: "id" }
  );
};

const ensureEstadosDefault = async () => {
  for (const [estadoAnterior, estadoNuevo] of Object.entries(ESTADOS_RENOMBRE)) {
    const registroAnterior = await db.models.EstadoInventarios.findOne({
      where: { name: estadoAnterior },
    });

    if (!registroAnterior) {
      continue;
    }

    const registroNuevo = await db.models.EstadoInventarios.findOne({
      where: { name: estadoNuevo },
    });

    if (registroNuevo) {
      await db.models.Inventarios.update(
        { estado: registroNuevo.id },
        { where: { estado: registroAnterior.id } }
      );
      await registroAnterior.destroy();
      console.log(
        `Estado legado ${estadoAnterior} fusionado en ${estadoNuevo}.`
      );
      continue;
    }

    await registroAnterior.update({ name: estadoNuevo });
    console.log(`Estado ${estadoAnterior} renombrado a ${estadoNuevo}.`);
  }

  for (const nombre of ESTADOS_DEFAULT) {
    const [estado, creado] = await db.models.EstadoInventarios.findOrCreate({
      where: { name: nombre },
      defaults: { name: nombre },
    });

    if (creado) {
      console.log(`Estado por defecto creado: ${estado.name}.`);
    }
  }
};

export const ensureInventarioModule = async () => {
  const queryInterface = db.getQueryInterface();

  await ensureEstadosInventarioTable(queryInterface);
  await ensureInventariosTable(queryInterface);
  await db.models.EstadoInventarios.sync();
  await ensureEstadosDefault();
};

const main = async () => {
  try {
    await db.authenticate();
    await ensureInventarioModule();

    console.log("Migracion del modulo de inventario completada correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("Error al preparar el modulo de inventario:", error);
    process.exit(1);
  }
};

const isDirectExecution =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectExecution) {
  main();
}
