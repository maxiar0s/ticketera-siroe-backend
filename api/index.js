import express from "express";
import db from "../config/db.js";
import cors from "cors";
import apiRoutes from "../routes/apiRoutes.js";
import usuarioRoutes from "../routes/usuarioRoutes.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración CORS más permisiva
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, token');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Manejar solicitudes preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Conexión a DB
try {
  await db.authenticate();
  await db.sync();
  console.log("Conexion a la base datos establecida");
} catch (error) {
  console.log(error);
}

// Add these test routes BEFORE your main route registration
app.get("/api-test", (req, res) => {
  res.json({ message: "API routes test endpoint" });
});

app.get("/auth-test", (req, res) => {
  res.json({ message: "Auth routes test endpoint" });
});

// Add a route to list all available routes
app.get("/routes", (req, res) => {
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

app.get("/auth/login-test", (req, res) => {
  res.json({
    message: "Login test endpoint",
    instructions:
      "To use the actual login, send a POST request to /auth/login with email and password in the request body",
  });
});

app.use("/auth/", usuarioRoutes);
app.use("/", apiRoutes);

app.get("/test", (req, res) => {
  res.json({ message: "Server is running correctly" });
});

const port = 3000;
app.listen(port, () => {
  console.log(`El servidor se esta ejecutando en el servidor ${port}`);
});
