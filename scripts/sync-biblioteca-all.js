/**
 * Script para sincronizar tablas de Biblioteca
 * Ejecutar con: node scripts/sync-biblioteca-all.js
 */

import db from "../config/db.js";
import {
  BibliotecaCategoriaModel,
  BibliotecaProyectoModel,
} from "../models/index.js";

const syncAll = async () => {
  try {
    console.log("Conectando a la base de datos...");
    await db.authenticate();
    console.log("Conexión establecida.\n");

    // 1. Sincronizar BibliotecaCategorias
    console.log("1. Sincronizando tabla BibliotecaCategorias...");
    await BibliotecaCategoriaModel.sync({ alter: true });
    console.log("   ✓ BibliotecaCategorias sincronizada\n");

    // 2. Sincronizar BibliotecaProyectos (para agregar categoriaId y contenido)
    console.log("2. Sincronizando tabla BibliotecaProyectos...");
    await BibliotecaProyectoModel.sync({ alter: true });
    console.log("   ✓ BibliotecaProyectos sincronizada\n");

    // 3. Crear categoría "Proyecto" por defecto con las tabs existentes
    console.log("3. Verificando categoría por defecto...");
    const categoriaExistente = await BibliotecaCategoriaModel.findOne({
      where: { nombre: "Proyecto" },
    });

    const tabsProyecto = [
      {
        id: "general",
        nombre: "General",
        tipoTexto: "normal",
        permiteAdjuntos: false,
        orden: 0,
      },
      {
        id: "repositorio",
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
        nombre: "Adjuntos Generales",
        tipoTexto: null,
        permiteAdjuntos: true,
        orden: 8,
      },
    ];

    if (!categoriaExistente) {
      await BibliotecaCategoriaModel.create({
        nombre: "Proyecto",
        color: "#6366f1",
        columnas: tabsProyecto,
      });
      console.log("   ✓ Categoría 'Proyecto' creada con tabs:\n");
      tabsProyecto.forEach((tab) => {
        const tipo = tab.tipoTexto === "privado" ? "🔒" : "📝";
        const adjuntos = tab.permiteAdjuntos ? "📎" : "";
        console.log(`      - ${tab.nombre} ${tipo} ${adjuntos}`);
      });
    } else {
      console.log("   ✓ Categoría 'Proyecto' ya existe\n");
    }

    console.log("\n========================================");
    console.log("¡Sincronización completada exitosamente!");
    console.log("========================================");
    process.exit(0);
  } catch (error) {
    console.error("Error durante la sincronización:", error);
    process.exit(1);
  }
};

syncAll();
