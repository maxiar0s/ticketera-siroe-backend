/**
 * @fileoverview Controlador de documentos y logs del sistema.
 * Maneja la documentación de clientes y los logs de auditoría.
 */

import { Op } from "sequelize";
import bucket from "../config/gcs.js";
import {
  CasaMatrizModel,
  CuentaCasaMatrizModel,
  CuentaModel,
  ClienteDocumentoModel,
  LogSistemaModel,
} from "../models/index.js";
import { CLIENTE_DOCUMENTO_TIPOS } from "../models/ClienteDocumento.js";
import registrarLog from "../utils/logger.js";
import { parseBooleanQueryParam } from "../utils/parsers.js";
import {
  normalizarTipoDocumento,
  cuentaPuedeGestionarDocumentos,
} from "../utils/validators.js";
import { buildDocumentoClienteResponse } from "../utils/builders.js";

// =====================================================
// Includes
// =====================================================

const documentoClienteIncludes = [
  {
    model: CasaMatrizModel,
    as: "cliente",
    attributes: ["id", "razonSocial", "rut"],
  },
  { model: CuentaModel, as: "subidoPor", attributes: ["id", "name"] },
];

// =====================================================
// Helper
// =====================================================

const getAuthorizedClientIds = async (cuentaId) => {
  const rows = await CuentaCasaMatrizModel.findAll({
    where: { cuentaId },
    attributes: ["casaMatrizId"],
    raw: true,
  });
  return rows.map((row) => row.casaMatrizId);
};

// =====================================================
// Endpoints de Documentación
// =====================================================

/**
 * Obtiene documentación de clientes.
 * GET /documentacion
 */
export const getDocumentacionClientes = async (req, res) => {
  try {
    const usuario = req.usuario;
    const {
      pagina = 1,
      limite = 10,
      clienteId,
      tipo,
      buscar,
      reciente,
    } = req.query;

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 10, 1), 100);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};
    const esCliente = usuario && usuario.tipoCuentaId === 4;

    if (esCliente) {
      const autorizados = await getAuthorizedClientIds(usuario.id);
      if (!autorizados.length) {
        return res.json({
          data: [],
          total: 0,
          pagina: pageNumber,
          paginasTotales: 0,
        });
      }
      where.casaMatrizId = { [Op.in]: autorizados };
    }

    if (clienteId) {
      const clienteIdNumero = Number.parseInt(`${clienteId}`, 10);
      if (!Number.isNaN(clienteIdNumero)) {
        where.casaMatrizId = clienteIdNumero;
      }
    }

    if (tipo) {
      const tipoNormalizado = normalizarTipoDocumento(tipo);
      if (tipoNormalizado) {
        where.tipo = tipoNormalizado;
      }
    }

    const terminoBusqueda = buscar ? `${buscar}`.trim() : "";
    if (terminoBusqueda) {
      where[Op.or] = [
        { descripcion: { [Op.like]: `%${terminoBusqueda}%` } },
        { nombreArchivo: { [Op.like]: `%${terminoBusqueda}%` } },
      ];
    }

    const orden = parseBooleanQueryParam(reciente, true)
      ? [["createdAt", "DESC"]]
      : [["createdAt", "ASC"]];

    const { rows, count } = await ClienteDocumentoModel.findAndCountAll({
      where,
      include: documentoClienteIncludes,
      order: orden,
      limit: limitNumber,
      offset,
    });

    const data = rows.map((row) => buildDocumentoClienteResponse(row));

    return res.json({
      data,
      total: count,
      pagina: pageNumber,
      paginasTotales: Math.ceil(count / limitNumber),
    });
  } catch (error) {
    console.error("Error al obtener la documentación de clientes:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener la documentación." });
  }
};

/**
 * Crea un documento de cliente.
 * POST /documentacion
 */
export const crearDocumentoCliente = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!cuentaPuedeGestionarDocumentos(usuario)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para crear documentos." });
    }

    const clienteId =
      typeof req.body?.clienteId === "string" ? req.body.clienteId.trim() : "";

    if (!clienteId.length) {
      return res.status(400).json({ error: "Debe seleccionar un cliente." });
    }

    const cliente = await CasaMatrizModel.findByPk(clienteId, {
      attributes: ["id"],
    });
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    const tipoNormalizado = normalizarTipoDocumento(req.body?.tipo);
    if (!tipoNormalizado) {
      return res
        .status(400)
        .json({ error: "El tipo de documento seleccionado no es válido." });
    }

    const descripcionLimpia =
      typeof req.body?.descripcion === "string"
        ? req.body.descripcion.trim()
        : "";

    const archivoSubido = req.documentoClienteArchivo;
    if (!archivoSubido) {
      return res.status(400).json({ error: "Debe adjuntar un archivo." });
    }

    const documento = await ClienteDocumentoModel.create({
      casaMatrizId: cliente.id,
      tipo: tipoNormalizado,
      descripcion: descripcionLimpia.length ? descripcionLimpia : null,
      archivo: archivoSubido.storageName,
      nombreArchivo: archivoSubido.originalName ?? null,
      mimeType: archivoSubido.mimeType ?? null,
      size:
        typeof archivoSubido.size === "number" && archivoSubido.size >= 0
          ? archivoSubido.size
          : null,
      subidoPorId: usuario?.id ?? null,
    });

    const documentoCompleto = await ClienteDocumentoModel.findByPk(
      documento.id,
      { include: documentoClienteIncludes }
    );

    await registrarLog(
      usuario?.id,
      "CREAR_DOCUMENTO_CLIENTE",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { documentoId: documento.id, clienteId: cliente.id }
    );

    return res
      .status(201)
      .json(buildDocumentoClienteResponse(documentoCompleto || documento));
  } catch (error) {
    console.error("Error al crear documento de cliente:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al guardar el documento." });
  }
};

/**
 * Elimina un documento de cliente.
 * DELETE /documentacion/:id
 */
export const eliminarDocumentoCliente = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!cuentaPuedeGestionarDocumentos(usuario)) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para eliminar documentos." });
    }

    const { id } = req.params;
    const documento = await ClienteDocumentoModel.findByPk(id);
    if (!documento) {
      return res.status(404).json({ error: "Documento no encontrado." });
    }

    const archivo = documento.archivo;
    await documento.destroy();

    if (archivo) {
      try {
        await bucket.file(archivo).delete();
      } catch (error) {
        console.warn(
          "No se pudo eliminar el archivo del almacenamiento:",
          error?.message || error
        );
      }
    }

    await registrarLog(
      usuario.id,
      "ELIMINAR_DOCUMENTO_CLIENTE",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { documentoId: id }
    );

    return res.json({ mensaje: "Documento eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar documento de cliente:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al eliminar el documento." });
  }
};

// =====================================================
// Logs del Sistema
// =====================================================

/**
 * Obtiene logs del sistema (solo administradores).
 * GET /logs
 */
export const getLogs = async (req, res) => {
  try {
    const usuario = req.usuario;
    if (usuario.tipoCuentaId !== 1) {
      return res
        .status(403)
        .json({ error: "No tiene permisos para ver los logs del sistema." });
    }

    const {
      pagina = 1,
      limite = 50,
      accion,
      usuarioId,
      desde,
      hasta,
    } = req.query;

    const pageNumber = Math.max(parseInt(pagina, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limite, 10) || 50, 1), 200);
    const offset = (pageNumber - 1) * limitNumber;

    const where = {};

    if (accion) {
      where.accion = { [Op.like]: `%${accion}%` };
    }

    if (usuarioId) {
      const usuarioIdNumero = Number.parseInt(`${usuarioId}`, 10);
      if (!Number.isNaN(usuarioIdNumero)) {
        where.cuentaId = usuarioIdNumero;
      }
    }

    if (desde) {
      const desdeDate = new Date(desde);
      if (!Number.isNaN(desdeDate.getTime())) {
        where.createdAt = { ...(where.createdAt || {}), [Op.gte]: desdeDate };
      }
    }

    if (hasta) {
      const hastaDate = new Date(hasta);
      if (!Number.isNaN(hastaDate.getTime())) {
        where.createdAt = { ...(where.createdAt || {}), [Op.lte]: hastaDate };
      }
    }

    const { rows, count } = await LogSistemaModel.findAndCountAll({
      where,
      include: [
        {
          model: CuentaModel,
          as: "cuenta",
          attributes: ["id", "name", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: limitNumber,
      offset,
    });

    return res.json({
      data: rows,
      total: count,
      pagina: pageNumber,
      paginasTotales: Math.ceil(count / limitNumber),
    });
  } catch (error) {
    console.error("Error al obtener logs:", error);
    return res
      .status(500)
      .json({ error: "Hubo un error al obtener los logs." });
  }
};

// =====================================================
// Utilidad de URLs firmadas
// =====================================================

import { generateSignedUrl } from "../config/gcs.js";

/**
 * Genera una URL firmada para un archivo.
 * GET /generar-url/:fileName
 */
export const generarUrl = async (req, res) => {
  const { fileName } = req.params;
  try {
    const signedUrl = await generateSignedUrl(fileName);
    res.json({ signedUrl });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error al generar la URL firmada" });
  }
};
