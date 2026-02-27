import express from "express";
import db from "../config/db.js";
import cors from "cors";
import apiRoutes from "../routes/apiRoutes.js";
import usuarioRoutes from "../routes/usuarioRoutes.js";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "../config/swagger.js";
import protegerRuta from "../middleware/protegerRuta.js";
import logRequest from "../middleware/logRequest.js";
import { initCronJobs } from "../services/cronService.js";
import { ensureTicketFuenteEnum } from "../scripts/ensure-ticket-fuente-enum.js";
import { ensureTicketCreatorEmailColumn } from "../scripts/ensure-ticket-creator-email.js";

const app = express();

app.use(
  cors({
    origin: [
      "https://app.soportesiroe.cl",
      "https://demo.soportesiroe.cl",
      "https://ticket.siroe.cl",
      "http://localhost:4200", // Para tus pruebas locales
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "token",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    credentials: true, // Permite cookies/headers seguros
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(logRequest);

// Conexión a DB
try {
  await db.authenticate();
  await ensureTicketFuenteEnum();
  await ensureTicketCreatorEmailColumn();
  // db.sync() removido - la base de datos ya tiene las tablas creadas
  // Solo se necesita sync() en desarrollo inicial o al agregar nuevas tablas
  console.log("Conexion a la base datos establecida");

  // Inicializar CRON jobs
  initCronJobs();
} catch (error) {
  console.log("Error conectando a la base de datos:", error.message);
}

// Add these test routes BEFORE your main route registration
app.get("/api-test", protegerRuta, (req, res) => {
  res.json({ message: "API routes test endpoint" });
});

app.get("/auth-test", protegerRuta, (req, res) => {
  res.json({ message: "Auth routes test endpoint" });
});

// Add a route to list all available routes
app.get("/routes", protegerRuta, (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods),
      });
    } else if (middleware.name === "router") {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods),
          });
        }
      });
    }
  });
  res.json(routes);
});

app.get("/auth/login-test", protegerRuta, (req, res) => {
  res.json({
    message: "Login test endpoint",
    instructions:
      "To use the actual login, send a POST request to /auth/login with email and password in the request body",
  });
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "Soporte Siroe API Docs",
  }),
);

app.get("/docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).json({
      status: "ok",
      service: "ss-ticketera-back",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      service: "ss-ticketera-back",
      timestamp: new Date().toISOString(),
      message: "Database unavailable",
    });
  }
});

app.use("/auth/", usuarioRoutes);
app.use("/", apiRoutes);

app.get("/test", protegerRuta, (req, res) => {
  res.json({ message: "Server is running correctly" });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`El servidor se esta ejecutando en el servidor ${port}`);
});
