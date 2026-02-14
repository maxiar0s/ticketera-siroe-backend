/**
 * @fileoverview Controlador de Biblioteca.
 * Maneja CRUD de proyectos de biblioteca (base de conocimiento).
 */

import { Op } from "sequelize";
import {
  BibliotecaProyectoModel,
  BibliotecaAdjuntoModel,
  BibliotecaCategoriaModel,
  CasaMatrizModel,
  CuentaModel,
} from "../models/index.js";
import { dispatchBibliotecaSync } from "../services/ragSyncService.js";

const bibliotecaIncludes = [
  {
    model: CasaMatrizModel,
    as: "casaMatriz",
    attributes: ["id", "razonSocial", "imagen"],
  },
  {
    model: BibliotecaCategoriaModel,
    as: "categoria",
    attributes: ["id", "nombre", "color", "columnas"],
  },
  { model: CuentaModel, as: "creadoPor", attributes: ["id", "name", "email"] },
  {
    model: CuentaModel,
    as: "actualizadoPor",
    attributes: ["id", "name", "email"],
  },
  {
    model: BibliotecaAdjuntoModel,
    as: "adjuntos",
    include: [
      { model: CuentaModel, as: "subidoPor", attributes: ["id", "name"] },
    ],
  },
];

// =====================================================
// Endpoints
// =====================================================

/**
 * Lista proyectos de biblioteca con paginación y filtros.
 * GET /biblioteca
 */
export const getBibliotecaProyectos = async (req, res) => {
  try {
    const {
      pagina = 1,
      limite = 10,
      buscar = "",
      casaMatrizId = "",
    } = req.query;

    const offset = (parseInt(pagina, 10) - 1) * parseInt(limite, 10);

    const whereClause = {};

    if (buscar) {
      whereClause[Op.or] = [
        { nombre: { [Op.like]: `%${buscar}%` } },
        { descripcion: { [Op.like]: `%${buscar}%` } },
      ];
    }

    if (casaMatrizId) {
      whereClause.casaMatrizId = casaMatrizId;
    }

    const { count, rows } = await BibliotecaProyectoModel.findAndCountAll({
      where: whereClause,
      include: bibliotecaIncludes,
      order: [["updatedAt", "DESC"]],
      limit: parseInt(limite, 10),
      offset,
      distinct: true,
    });

    return res.json({
      data: rows,
      total: count,
      pagina: parseInt(pagina, 10),
      paginasTotales: Math.ceil(count / parseInt(limite, 10)),
    });
  } catch (error) {
    console.error("Error al obtener proyectos de biblioteca:", error);
    return res.status(500).json({
      error: "Error al obtener proyectos de biblioteca",
      detalle: error.message,
    });
  }
};

/**
 * Obtiene un proyecto de biblioteca por ID.
 * GET /biblioteca/:id
 */
export const getBibliotecaProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const proyecto = await BibliotecaProyectoModel.findByPk(id, {
      include: bibliotecaIncludes,
    });

    if (!proyecto) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }

    return res.json(proyecto);
  } catch (error) {
    console.error("Error al obtener proyecto de biblioteca:", error);
    return res.status(500).json({
      error: "Error al obtener proyecto de biblioteca",
      detalle: error.message,
    });
  }
};

/**
 * Crea un nuevo proyecto de biblioteca.
 * POST /biblioteca
 */
export const crearBibliotecaProyecto = async (req, res) => {
  try {
    const {
      casaMatrizId,
      categoriaId,
      nombre,
      descripcion,
      linkRepositorio,
      envVariables,
      credenciales,
      instruccionesInstalacion,
      instruccionesProd,
      manualUsuario,
      notasTecnicas,
      tecnologias,
      contenido,
    } = req.body;

    const usuarioId = req.usuario?.id;

    if (!casaMatrizId || !nombre) {
      return res.status(400).json({
        error: "El cliente (casaMatrizId) y el nombre son obligatorios",
      });
    }

    // Verificar que el cliente existe
    const cliente = await CasaMatrizModel.findByPk(casaMatrizId);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    // Parsear tecnologías si viene como string
    let tecnologiasArray = [];
    if (tecnologias) {
      try {
        tecnologiasArray =
          typeof tecnologias === "string"
            ? JSON.parse(tecnologias)
            : tecnologias;
      } catch {
        tecnologiasArray = [];
      }
    }

    // Parsear contenido dinámico si viene como string
    let contenidoParsed = null;
    if (contenido) {
      try {
        contenidoParsed =
          typeof contenido === "string" ? JSON.parse(contenido) : contenido;
      } catch {
        contenidoParsed = null;
      }
    }

    const nuevoProyecto = await BibliotecaProyectoModel.create({
      casaMatrizId,
      categoriaId: categoriaId || null,
      nombre,
      descripcion: descripcion || null,
      linkRepositorio: linkRepositorio || null,
      envVariables: envVariables || null,
      credenciales: credenciales || null,
      instruccionesInstalacion: instruccionesInstalacion || null,
      instruccionesProd: instruccionesProd || null,
      manualUsuario: manualUsuario || null,
      notasTecnicas: notasTecnicas || null,
      tecnologias: tecnologiasArray,
      contenido: contenidoParsed,
      creadoPorId: usuarioId,
      actualizadoPorId: usuarioId,
    });

    // Procesar adjuntos por sección
    if (req.bibliotecaFiles && Object.keys(req.bibliotecaFiles).length > 0) {
      const adjuntosData = [];

      for (const [key, files] of Object.entries(req.bibliotecaFiles)) {
        // Limpiar prefijo "files_" para guardar sección limpia (ej: files_env -> env)
        const seccion = key.replace("files_", "");

        files.forEach((archivo) => {
          adjuntosData.push({
            bibliotecaProyectoId: nuevoProyecto.id,
            archivo: archivo.storageName, // El middleware devuelve storageName
            nombreArchivo: archivo.originalName,
            mimeType: archivo.mimeType,
            seccion: seccion,
            subidoPorId: usuarioId,
          });
        });
      }

      if (adjuntosData.length > 0) {
        await BibliotecaAdjuntoModel.bulkCreate(adjuntosData);
      }
    }

    // Obtener el proyecto con sus relaciones
    const proyectoCompleto = await BibliotecaProyectoModel.findByPk(
      nuevoProyecto.id,
      { include: bibliotecaIncludes },
    );

    dispatchBibliotecaSync({
      action: "upsert",
      projectId: nuevoProyecto.id,
      triggeredBy: `biblioteca:create:${usuarioId || "system"}`,
    });

    return res.status(201).json(proyectoCompleto);
  } catch (error) {
    console.error("Error al crear proyecto de biblioteca:", error);
    return res.status(500).json({
      error: "Error al crear proyecto de biblioteca",
      detalle: error.message,
    });
  }
};

/**
 * Actualiza un proyecto de biblioteca.
 * PUT /biblioteca/:id
 */
export const actualizarBibliotecaProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      casaMatrizId,
      categoriaId,
      nombre,
      descripcion,
      linkRepositorio,
      envVariables,
      credenciales,
      instruccionesInstalacion,
      instruccionesProd,
      manualUsuario,
      notasTecnicas,
      tecnologias,
      contenido,
    } = req.body;

    const usuarioId = req.usuario?.id;

    const proyecto = await BibliotecaProyectoModel.findByPk(id);

    if (!proyecto) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }

    // Parsear tecnologías si viene como string
    let tecnologiasArray = proyecto.tecnologias;
    if (tecnologias !== undefined) {
      try {
        tecnologiasArray =
          typeof tecnologias === "string"
            ? JSON.parse(tecnologias)
            : tecnologias;
      } catch {
        tecnologiasArray = [];
      }
    }

    // Parsear contenido dinámico si viene como string
    let contenidoParsed = proyecto.contenido;
    if (contenido !== undefined) {
      try {
        contenidoParsed =
          typeof contenido === "string" ? JSON.parse(contenido) : contenido;
      } catch {
        contenidoParsed = null;
      }
    }

    await proyecto.update({
      casaMatrizId: casaMatrizId || proyecto.casaMatrizId,
      categoriaId:
        categoriaId !== undefined ? categoriaId || null : proyecto.categoriaId,
      nombre: nombre || proyecto.nombre,
      descripcion:
        descripcion !== undefined ? descripcion : proyecto.descripcion,
      linkRepositorio:
        linkRepositorio !== undefined
          ? linkRepositorio
          : proyecto.linkRepositorio,
      envVariables:
        envVariables !== undefined ? envVariables : proyecto.envVariables,
      credenciales:
        credenciales !== undefined ? credenciales : proyecto.credenciales,
      instruccionesInstalacion:
        instruccionesInstalacion !== undefined
          ? instruccionesInstalacion
          : proyecto.instruccionesInstalacion,
      instruccionesProd:
        instruccionesProd !== undefined
          ? instruccionesProd
          : proyecto.instruccionesProd,
      manualUsuario:
        manualUsuario !== undefined ? manualUsuario : proyecto.manualUsuario,
      notasTecnicas:
        notasTecnicas !== undefined ? notasTecnicas : proyecto.notasTecnicas,
      tecnologias: tecnologiasArray,
      contenido: contenidoParsed,
      actualizadoPorId: usuarioId,
    });

    // Procesar nuevos adjuntos por sección
    if (req.bibliotecaFiles && Object.keys(req.bibliotecaFiles).length > 0) {
      const adjuntosData = [];

      for (const [key, files] of Object.entries(req.bibliotecaFiles)) {
        const seccion = key.replace("files_", "");

        files.forEach((archivo) => {
          adjuntosData.push({
            bibliotecaProyectoId: proyecto.id,
            archivo: archivo.storageName,
            nombreArchivo: archivo.originalName,
            mimeType: archivo.mimeType,
            seccion: seccion,
            subidoPorId: usuarioId,
          });
        });
      }

      if (adjuntosData.length > 0) {
        await BibliotecaAdjuntoModel.bulkCreate(adjuntosData);
      }
    }

    // Obtener el proyecto actualizado con sus relaciones
    const proyectoActualizado = await BibliotecaProyectoModel.findByPk(id, {
      include: bibliotecaIncludes,
    });

    dispatchBibliotecaSync({
      action: "upsert",
      projectId: Number(id),
      triggeredBy: `biblioteca:update:${usuarioId || "system"}`,
    });

    return res.json(proyectoActualizado);
  } catch (error) {
    console.error("Error al actualizar proyecto de biblioteca:", error);
    return res.status(500).json({
      error: "Error al actualizar proyecto de biblioteca",
      detalle: error.message,
    });
  }
};

/**
 * Elimina un proyecto de biblioteca.
 * DELETE /biblioteca/:id
 */
export const eliminarBibliotecaProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const proyecto = await BibliotecaProyectoModel.findByPk(id);

    if (!proyecto) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }

    // Los adjuntos se eliminan automáticamente por CASCADE
    await proyecto.destroy();

    dispatchBibliotecaSync({
      action: "delete",
      projectId: Number(id),
      triggeredBy: `biblioteca:delete:${req.usuario?.id || "system"}`,
    });

    return res.json({ mensaje: "Proyecto eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar proyecto de biblioteca:", error);
    return res.status(500).json({
      error: "Error al eliminar proyecto de biblioteca",
      detalle: error.message,
    });
  }
};

/**
 * Agrega adjuntos a un proyecto de biblioteca.
 * POST /biblioteca/:id/adjuntos
 */
export const agregarAdjuntosBiblioteca = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario?.id;

    const proyecto = await BibliotecaProyectoModel.findByPk(id);

    if (!proyecto) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }

    if (!req.bibliotecaFiles || Object.keys(req.bibliotecaFiles).length === 0) {
      return res.status(400).json({ error: "No se proporcionaron archivos" });
    }

    const adjuntosData = [];

    for (const [key, files] of Object.entries(req.bibliotecaFiles)) {
      const seccion = key.replace("files_", "");

      files.forEach((archivo) => {
        adjuntosData.push({
          bibliotecaProyectoId: proyecto.id,
          archivo: archivo.storageName,
          nombreArchivo: archivo.originalName,
          mimeType: archivo.mimeType,
          seccion: seccion,
          subidoPorId: usuarioId,
        });
      });
    }

    const nuevosAdjuntos =
      await BibliotecaAdjuntoModel.bulkCreate(adjuntosData);

    return res.status(201).json(nuevosAdjuntos);
  } catch (error) {
    console.error("Error al agregar adjuntos:", error);
    return res.status(500).json({
      error: "Error al agregar adjuntos",
      detalle: error.message,
    });
  }
};

/**
 * Elimina un adjunto de un proyecto de biblioteca.
 * DELETE /biblioteca/:id/adjuntos/:adjuntoId
 */
export const eliminarAdjuntoBiblioteca = async (req, res) => {
  try {
    const { id, adjuntoId } = req.params;

    const adjunto = await BibliotecaAdjuntoModel.findOne({
      where: { id: adjuntoId, bibliotecaProyectoId: id },
    });

    if (!adjunto) {
      return res.status(404).json({ error: "Adjunto no encontrado" });
    }

    await adjunto.destroy();

    return res.json({ mensaje: "Adjunto eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar adjunto:", error);
    return res.status(500).json({
      error: "Error al eliminar adjunto",
      detalle: error.message,
    });
  }
};
