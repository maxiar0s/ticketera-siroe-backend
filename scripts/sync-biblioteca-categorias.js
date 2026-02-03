/**
 * Script para sincronizar BibliotecaCategorias
 * Ejecutar con: node scripts/sync-biblioteca-categorias.js
 */

import db from "../config/db.js";
import { BibliotecaCategoriaModel } from "../models/index.js";

const syncBibliotecaCategorias = async () => {
  try {
    console.log("Conectando a la base de datos...");
    await db.authenticate();
    console.log("Conexión establecida.");

    console.log("Sincronizando tabla BibliotecaCategorias...");
    await BibliotecaCategoriaModel.sync({ alter: true });
    console.log("Tabla BibliotecaCategorias sincronizada correctamente.");

    // Opcionalmente, crear una categoría por defecto "Proyecto"
    const categoriaExistente = await BibliotecaCategoriaModel.findOne({
      where: { nombre: "Proyecto" },
    });

    if (!categoriaExistente) {
      console.log("Creando categoría por defecto 'Proyecto'...");
      await BibliotecaCategoriaModel.create({
        nombre: "Proyecto",
        color: "#6366f1",
        columnas: [
          {
            id: "general",
            nombre: "General",
            tipoTexto: "normal",
            permiteAdjuntos: false,
            orden: 0,
          },
          {
            id: "repo",
            nombre: "Repositorio",
            tipoTexto: "normal",
            permiteAdjuntos: false,
            orden: 1,
          },
          {
            id: "env",
            nombre: ".ENV",
            tipoTexto: "privado",
            permiteAdjuntos: true,
            orden: 2,
          },
          {
            id: "instalacion",
            nombre: "Instalación",
            tipoTexto: "normal",
            permiteAdjuntos: true,
            orden: 3,
          },
          {
            id: "produccion",
            nombre: "Producción",
            tipoTexto: "normal",
            permiteAdjuntos: true,
            orden: 4,
          },
          {
            id: "manual",
            nombre: "Manual",
            tipoTexto: "normal",
            permiteAdjuntos: true,
            orden: 5,
          },
          {
            id: "credenciales",
            nombre: "Credenciales",
            tipoTexto: "privado",
            permiteAdjuntos: true,
            orden: 6,
          },
          {
            id: "notas",
            nombre: "Notas",
            tipoTexto: "normal",
            permiteAdjuntos: false,
            orden: 7,
          },
          {
            id: "adjuntos",
            nombre: "Adjuntos",
            tipoTexto: null,
            permiteAdjuntos: true,
            orden: 8,
          },
        ],
      });
      console.log("Categoría 'Proyecto' creada.");
    } else {
      console.log("Categoría 'Proyecto' ya existe.");
    }

    console.log("¡Sincronización completada!");
    process.exit(0);
  } catch (error) {
    console.error("Error durante la sincronización:", error);
    process.exit(1);
  }
};

syncBibliotecaCategorias();
