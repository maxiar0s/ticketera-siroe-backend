import db from "../config/db.js";

const TABLE_NAME = "Tickets";
const COLUMN_NAME = "fuente";
const REQUIRED_VALUES = ["Web", "Email", "Telegram IA", "Agente IA"];

const normalizeType = (value) => `${value || ""}`.toLowerCase().replace(/\s+/g, "");

const hasAllEnumValues = (columnType, requiredValues) => {
  const normalizedType = normalizeType(columnType);
  return requiredValues.every((item) => normalizedType.includes(normalizeType(`'${item}'`)));
};

export const ensureTicketFuenteEnum = async () => {
  const queryInterface = db.getQueryInterface();
  const tableDefinition = await queryInterface.describeTable(TABLE_NAME);
  const columnDefinition = tableDefinition[COLUMN_NAME];

  if (!columnDefinition) {
    throw new Error(`No existe la columna ${COLUMN_NAME} en la tabla ${TABLE_NAME}.`);
  }

  const currentType =
    typeof columnDefinition.type === "string"
      ? columnDefinition.type
      : String(columnDefinition.type || "");

  if (hasAllEnumValues(currentType, REQUIRED_VALUES)) {
    console.log(`Enum ${TABLE_NAME}.${COLUMN_NAME} ya contiene ${REQUIRED_VALUES.join(", ")}.`);
    return;
  }

  await db.query(`
    ALTER TABLE \`${TABLE_NAME}\`
    MODIFY COLUMN \`${COLUMN_NAME}\` ENUM('Web', 'Email', 'Telegram IA', 'Agente IA')
    NOT NULL DEFAULT 'Web';
  `);

  console.log(`Enum ${TABLE_NAME}.${COLUMN_NAME} actualizado con valor 'Agente IA'.`);
};
