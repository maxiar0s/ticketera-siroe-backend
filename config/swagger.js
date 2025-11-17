import path from "path";
import { fileURLToPath } from "url";
import swaggerJSDoc from "swagger-jsdoc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      url: "https://api.soportesiroe.cl",
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
};

const toGlob = (pattern) => pattern.replace(/\\/g, "/");

const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [
    toGlob(path.join(__dirname, "../routes/**/*.js")),
    toGlob(path.join(__dirname, "../docs/swagger/**/*.{yaml,yml}")),
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export default swaggerSpec;
