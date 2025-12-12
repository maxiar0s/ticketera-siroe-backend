import { DataTypes } from "sequelize";
import db from "../config/db.js";

const TicketTag = db.define(
  "TicketTags",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tagId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "TicketTags",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["ticketId", "tagId"],
      },
    ],
  }
);

export default TicketTag;
