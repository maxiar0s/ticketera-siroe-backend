import { DataTypes } from "sequelize";
import db from "../config/db.js";

const normalizarEncargados = (value) => {
  if (!value) {
    return [];
  }

  let lista = [];

  if (Array.isArray(value)) {
    lista = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        lista = parsed;
      } else {
        lista = trimmed.split(",");
      }
    } catch (_error) {
      lista = trimmed.split(",");
    }
  } else if (typeof value === "number") {
    lista = [value];
  } else {
    return [];
  }

  const numeros = lista
    .map((item) => Number.parseInt(`${item}`, 10))
    .filter((numero) => Number.isInteger(numero) && numero > 0);

  return Array.from(new Set(numeros));
};

const Proyecto = db.define(
  "Proyectos",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
      get() {
        const raw = this.getDataValue("encargados");
        return normalizarEncargados(raw);
      },
      set(value) {
        const normalizado = normalizarEncargados(value);
        this.setDataValue("encargados", JSON.stringify(normalizado));
      },
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
  },
  {
    tableName: "Proyectos",
    timestamps: true,
  }
);

export default Proyecto;
