import { DataTypes } from "sequelize";
import db from "../config/db.js";

const PROYECTOS_TABLE = "Proyectos";
const PROYECTO_ADJUNTOS_TABLE = "ProyectoAdjuntos";
const BITACORAS_TABLE = "Bitacoras";

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
  onDelete = "SET NULL"
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

const ensureColumn = async (queryInterface, tableName, columnName, definition) => {
  const definitionMap = await queryInterface.describeTable(tableName);
  if (!definitionMap[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
    console.log(`Columna ${columnName} agregada a ${tableName}.`);
  }
};

const ensureProyectosTable = async (queryInterface) => {
  const exists = await tableExists(queryInterface, PROYECTOS_TABLE);

  if (!exists) {
    await queryInterface.createTable(PROYECTOS_TABLE, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      encargados: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "[]",
      },
      fechaInicio: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      fechaTermino: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      fotoPortada: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      creadoPorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      actualizadoPorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
      },
      updatedAt: {
        type: DataTypes.DATE,
      },
    });
    console.log(`Tabla ${PROYECTOS_TABLE} creada.`);
  }

  // Garantizar columnas clave por si la tabla existia previamente
  await ensureColumn(queryInterface, PROYECTOS_TABLE, "encargados", {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: "[]",
  });
  await ensureColumn(queryInterface, PROYECTOS_TABLE, "fechaInicio", {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });
  await ensureColumn(queryInterface, PROYECTOS_TABLE, "fechaTermino", {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });
  await ensureColumn(queryInterface, PROYECTOS_TABLE, "fotoPortada", {
    type: DataTypes.STRING(255),
    allowNull: true,
  });
  await ensureColumn(queryInterface, PROYECTOS_TABLE, "creadoPorId", {
    type: DataTypes.INTEGER,
    allowNull: true,
  });
  await ensureColumn(queryInterface, PROYECTOS_TABLE, "actualizadoPorId", {
    type: DataTypes.INTEGER,
    allowNull: true,
  });

  await ensureIndex(queryInterface, PROYECTOS_TABLE, {
    fields: ["createdAt"],
    name: "idx_proyectos_created_at",
  });

  await ensureIndex(queryInterface, PROYECTOS_TABLE, {
    fields: ["nombre"],
    name: "idx_proyectos_nombre",
  });

  await ensureForeignKey(
    queryInterface,
    PROYECTOS_TABLE,
    "creadoPorId",
    "fk_proyectos_creadoPor",
    { table: "Cuentas", field: "id" }
  );

  await ensureForeignKey(
    queryInterface,
    PROYECTOS_TABLE,
    "actualizadoPorId",
    "fk_proyectos_actualizadoPor",
    { table: "Cuentas", field: "id" }
  );
};

const ensureProyectoAdjuntosTable = async (queryInterface) => {
  const exists = await tableExists(queryInterface, PROYECTO_ADJUNTOS_TABLE);

  if (!exists) {
    await queryInterface.createTable(PROYECTO_ADJUNTOS_TABLE, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      proyectoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      archivo: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      nombreArchivo: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      mimeType: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      subidoPorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
      },
      updatedAt: {
        type: DataTypes.DATE,
      },
    });
    console.log(`Tabla ${PROYECTO_ADJUNTOS_TABLE} creada.`);
  }

  await ensureColumn(queryInterface, PROYECTO_ADJUNTOS_TABLE, "nombreArchivo", {
    type: DataTypes.STRING(255),
    allowNull: true,
  });
  await ensureColumn(queryInterface, PROYECTO_ADJUNTOS_TABLE, "mimeType", {
    type: DataTypes.STRING(255),
    allowNull: true,
  });
  await ensureColumn(queryInterface, PROYECTO_ADJUNTOS_TABLE, "subidoPorId", {
    type: DataTypes.INTEGER,
    allowNull: true,
  });

  await ensureIndex(queryInterface, PROYECTO_ADJUNTOS_TABLE, {
    fields: ["proyectoId"],
    name: "idx_proyectoadjuntos_proyectoId",
  });

  await ensureIndex(queryInterface, PROYECTO_ADJUNTOS_TABLE, {
    fields: ["subidoPorId"],
    name: "idx_proyectoadjuntos_subidoPorId",
  });

  await ensureForeignKey(
    queryInterface,
    PROYECTO_ADJUNTOS_TABLE,
    "proyectoId",
    "fk_proyectoAdjuntos_proyecto",
    { table: PROYECTOS_TABLE, field: "id" },
    "CASCADE",
    "CASCADE"
  );

  await ensureForeignKey(
    queryInterface,
    PROYECTO_ADJUNTOS_TABLE,
    "subidoPorId",
    "fk_proyectoAdjuntos_subidoPor",
    { table: "Cuentas", field: "id" }
  );
};

const ensureBitacorasProyecto = async (queryInterface) => {
  await ensureColumn(queryInterface, BITACORAS_TABLE, "proyectoId", {
    type: DataTypes.INTEGER,
    allowNull: true,
  });

  await ensureIndex(queryInterface, BITACORAS_TABLE, {
    fields: ["proyectoId"],
    name: "idx_bitacoras_proyectoId",
  });

  await ensureForeignKey(
    queryInterface,
    BITACORAS_TABLE,
    "proyectoId",
    "fk_bitacoras_proyecto",
    { table: PROYECTOS_TABLE, field: "id" }
  );
};

const run = async () => {
  try {
    await db.authenticate();
    const queryInterface = db.getQueryInterface();

    await ensureProyectosTable(queryInterface);
    await ensureProyectoAdjuntosTable(queryInterface);
    await ensureBitacorasProyecto(queryInterface);

    console.log("Migracion del modulo de proyectos completada correctamente.");
  } catch (error) {
    console.error("Error al preparar el modulo de proyectos:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

run();
