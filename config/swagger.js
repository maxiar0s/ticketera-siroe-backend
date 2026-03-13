import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import swaggerJSDoc from "swagger-jsdoc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROUTE_FILES = [
  {
    filePath: path.join(__dirname, "../routes/apiRoutes.js"),
    basePath: "",
  },
  {
    filePath: path.join(__dirname, "../routes/usuarioRoutes.js"),
    basePath: "/auth",
  },
];

const TAG_MAP = {
  "Autenticacion": "Autenticacion",
  "Usuarios": "Usuarios",
  "Clientes (Casas Matriz)": "Clientes",
  "Clientes": "Clientes",
  "Documentacion de clientes": "Documentacion Clientes",
  "Documentación de clientes": "Documentacion Clientes",
  "Sucursales": "Sucursales",
  "Tipos de equipos y campos (solo administradores)": "Configuracion Equipos",
  "Tipos de equipos y formularios": "Tipos Equipos",
  "Estados de equipos": "Estados Equipos",
  "Estados de sucursales": "Estados Sucursales",
  "Equipos": "Equipos",
  "Tags de clientes": "Tags",
  "Notificaciones": "Notificaciones",
  "Proyectos": "Proyectos",
  "Vehiculos": "Vehiculos",
  "Vehículos": "Vehiculos",
  "Estados de inventario": "Estados Inventario",
  "Inventario": "Inventario",
  "Bitacoras": "Bitacoras",
  "Bitácoras": "Bitacoras",
  "Tickets": "Tickets",
  "Chat de Tickets": "Chat Tickets",
  "Agente IA": "Agente IA",
  "Visitas programadas": "Visitas Programadas",
  "Google Cloud Storage": "Archivos",
  "Logs del sistema": "Logs",
  "Biblioteca": "Biblioteca",
  "Biblioteca Categorias": "Biblioteca Categorias",
  "Biblioteca Categorías": "Biblioteca Categorias",
  "Rutas de proyectos de biblioteca": "Biblioteca",
};

const TAG_DESCRIPTIONS = {
  "Autenticacion": "Inicio de sesion, recuperacion de acceso y cierre de sesion.",
  "Usuarios": "Administracion de cuentas, perfil y tecnicos disponibles.",
  "Clientes": "Gestion de clientes, sucursales relacionadas y consultas generales.",
  "Documentacion Clientes": "Carga y administracion de documentos asociados a clientes.",
  "Sucursales": "Operaciones sobre sucursales y estados vinculados.",
  "Configuracion Equipos": "Catalogos administrativos para tipos, campos y departamentos de equipos.",
  "Tipos Equipos": "Consulta de tipos de equipos y formularios dinamicos.",
  "Estados Equipos": "Consulta y actualizacion de estados de equipos.",
  "Estados Sucursales": "Consulta y actualizacion de estados de sucursales.",
  "Equipos": "Alta, actualizacion, consulta y eliminacion de equipos.",
  "Tags": "Gestion de etiquetas asociadas a clientes.",
  "Notificaciones": "Consulta y marcacion de notificaciones.",
  "Proyectos": "Gestion de proyectos, adjuntos y bitacoras asociadas.",
  "Vehiculos": "Gestion de vehiculos y sus salidas.",
  "Estados Inventario": "Gestion del catalogo de estados para items de inventario.",
  "Inventario": "Gestion de items inventariables y su estado actual.",
  "Bitacoras": "Consulta y gestion de bitacoras tecnicas.",
  "Tickets": "Consulta y gestion de tickets de soporte.",
  "Chat Tickets": "Mensajeria, actividad y timeline de tickets.",
  "Agente IA": "Interaccion con el agente de asistencia integrado.",
  "Visitas Programadas": "Agenda y eliminacion de visitas programadas.",
  "Archivos": "Generacion de URLs firmadas y manejo de archivos.",
  "Logs": "Consulta de logs del sistema.",
  "Biblioteca": "Gestion de proyectos y adjuntos de la biblioteca.",
  "Biblioteca Categorias": "Gestion de categorias para la biblioteca.",
};

const UPLOAD_MIDDLEWARE_TOKENS = [
  "handleUpload",
  "handleFiles",
  "handleProjectAssets",
  "handleVehiculoSalidaArchivos",
  "handleDocumentoCliente",
  "handleClienteImages",
  "handleBibliotecaAssets",
];

const IGNORED_COMMENTS = [
  "Rutas de Administrador",
  "Rutas de Administrador y Tecnico",
  "Rutas de Administrador y Técnico",
  "Rutas Generales",
  "Rutas de Biblioteca",
  "IMPORTANTE:",
  "Conexión a DB",
  "Add these test routes BEFORE your main route registration",
  "Add a route to list all available routes",
  "URL sin proteccion",
];

function normalizeComment(comment) {
  return comment
    .replace(/^\/\/\s*/, "")
    .replace(/^[=-]+$/, "")
    .trim();
}

function shouldUseCommentAsTag(comment) {
  if (!comment) {
    return false;
  }

  if (IGNORED_COMMENTS.some((ignored) => comment.startsWith(ignored))) {
    return false;
  }

  return !comment.includes("====");
}

function normalizeTag(comment, fallback = "General") {
  return TAG_MAP[comment] || comment || fallback;
}

function normalizeSwaggerPath(routePath, basePath = "") {
  const fullPath = `${basePath}${routePath}` || "/";

  return fullPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function getPathParameters(swaggerPath) {
  const matches = swaggerPath.match(/\{([A-Za-z0-9_]+)\}/g) || [];

  return matches.map((match) => {
    const name = match.slice(1, -1);

    return {
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
      description: `Parametro de ruta ${name}.`,
    };
  });
}

function buildSummary(method, tag, swaggerPath) {
  const actionMap = {
    get: "Obtener",
    post: "Crear o ejecutar",
    put: "Actualizar",
    patch: "Actualizar parcialmente",
    delete: "Eliminar",
  };

  return `${actionMap[method] || "Operar sobre"} ${tag.toLowerCase()} (${swaggerPath})`;
}

function buildResponses(method) {
  if (method === "delete") {
    return {
      200: {
        description: "Operacion completada correctamente.",
      },
      401: {
        description: "No autenticado.",
      },
      403: {
        description: "Sin permisos suficientes.",
      },
      404: {
        description: "Recurso no encontrado.",
      },
      500: {
        description: "Error interno del servidor.",
      },
    };
  }

  return {
    200: {
      description: "Operacion completada correctamente.",
    },
    400: {
      description: "Solicitud invalida.",
    },
    401: {
      description: "No autenticado.",
    },
    403: {
      description: "Sin permisos suficientes.",
    },
    404: {
      description: "Recurso no encontrado.",
    },
    500: {
      description: "Error interno del servidor.",
    },
  };
}

function buildRequestBody(method, statement) {
  if (!["post", "put", "patch"].includes(method)) {
    return undefined;
  }

  const hasUploadMiddleware = UPLOAD_MIDDLEWARE_TOKENS.some((token) =>
    statement.includes(token),
  );

  const contentType = hasUploadMiddleware
    ? "multipart/form-data"
    : "application/json";

  return {
    required: false,
    content: {
      [contentType]: {
        schema: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
  };
}

function parseRouteStatements(fileContent, basePath = "") {
  const lines = fileContent.split(/\r?\n/);
  const routes = [];
  let currentTag = basePath === "/auth" ? "Autenticacion" : "General";

  for (let index = 0; index < lines.length; index += 1) {
    const trimmedLine = lines[index].trim();

    if (trimmedLine.startsWith("//")) {
      const comment = normalizeComment(trimmedLine);

      if (shouldUseCommentAsTag(comment)) {
        currentTag = normalizeTag(comment, currentTag);
      } else if (comment === "URL sin proteccion") {
        currentTag = "Autenticacion";
      }

      continue;
    }

    if (!trimmedLine.startsWith("router.")) {
      continue;
    }

    let statement = trimmedLine;

    while (!statement.trim().endsWith(";") && index + 1 < lines.length) {
      index += 1;
      statement += ` ${lines[index].trim()}`;
    }

    const match = statement.match(/router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/i);

    if (!match) {
      continue;
    }

    const method = match[1].toLowerCase();
    const routePath = match[2];
    const swaggerPath = normalizeSwaggerPath(routePath, basePath);
    const tag = currentTag;
    const operation = {
      tags: [tag],
      summary: buildSummary(method, tag, swaggerPath),
      description: `Endpoint ${method.toUpperCase()} ${swaggerPath}.`,
      operationId: `${method}${swaggerPath
        .replace(/[^A-Za-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join("")}`,
      parameters: getPathParameters(swaggerPath),
      responses: buildResponses(method),
    };

    if (statement.includes("protegerRuta")) {
      operation.security = [{ bearerAuth: [] }];
    }

    const requestBody = buildRequestBody(method, statement);

    if (requestBody) {
      operation.requestBody = requestBody;
    }

    routes.push({
      swaggerPath,
      method,
      operation,
      tag,
    });
  }

  return routes;
}

function buildGeneratedPaths() {
  const routes = ROUTE_FILES.flatMap(({ filePath, basePath }) => {
    const fileContent = fs.readFileSync(filePath, "utf8");
    return parseRouteStatements(fileContent, basePath);
  });

  return routes.reduce((paths, { swaggerPath, method, operation }) => {
    if (!paths[swaggerPath]) {
      paths[swaggerPath] = {};
    }

    paths[swaggerPath][method] = operation;
    return paths;
  }, {});
}

function buildGeneratedTags() {
  const knownTags = Object.keys(TAG_DESCRIPTIONS);

  return knownTags.map((name) => ({
    name,
    description: TAG_DESCRIPTIONS[name],
  }));
}

const generatedPaths = buildGeneratedPaths();
const generatedTags = buildGeneratedTags();

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "Soporte Siroe API",
    version: "1.0.0",
    description:
      "Documentación oficial del backend de Soporte Siroe. Actualiza este archivo cuando se agreguen nuevos módulos o se modifiquen los contratos.",
    contact: {
      name: "Equipo de Soporte Siroe",
      email: "soporte@soportesiroe.cl",
    },
  },
  servers: [
    {
      url: "https://api-ticketera.siroe.cl",
      description: "Producción",
    },
    {
      url: "http://localhost:3000",
      description: "Desarrollo",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Todas las rutas protegidas requieren el token JWT entregado durante el inicio de sesión.",
      },
    },
  },
  tags: generatedTags,
  paths: generatedPaths,
};

const toGlob = (pattern) => pattern.replace(/\\/g, "/");

const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [
    toGlob(path.join(__dirname, "../docs/swagger/**/*.{yaml,yml}")),
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export default swaggerSpec;
