import jwt from "jsonwebtoken";
import registrarLog from "../utils/logger.js";

const logRequest = (req, res, next) => {
  // Solo loggear operaciones de escritura para reducir carga en la BD
  const methodsToLog = ["POST", "PUT", "DELETE", "PATCH"];

  if (!methodsToLog.includes(req.method) || req.path.startsWith("/auth/")) {
    // No loggear GET requests ni auth (auth se loggea en su controller)
    return next();
  }

  // Extract user ID from token if available, but don't block request if not
  let usuarioId = null;
  try {
    const header = req.headers["token"];
    const token = header && header.split(" ")[1];
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded) {
        usuarioId = decoded.id;
      }
    }
  } catch (error) {
    // Ignore token errors here, auth middleware handles security
  }

  const detalles = {
    query: req.query,
    body: req.body,
  };

  // Sanitize sensitive data from body if needed (e.g. passwords)
  if (detalles.body && detalles.body.password) {
    detalles.body = { ...detalles.body, password: "***" };
  }

  // Loggear de forma asíncrona (no esperar a que termine)
  registrarLog(
    usuarioId,
    "CONSULTA",
    req.method,
    req.path,
    req.ip || req.connection.remoteAddress,
    detalles
  ).catch((err) => console.error("Error al registrar log:", err));

  next();
};

export default logRequest;
