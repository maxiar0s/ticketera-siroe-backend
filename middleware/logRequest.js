import jwt from "jsonwebtoken";
import registrarLog from "../utils/logger.js";

const logRequest = (req, res, next) => {
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

  // Log the request
  // We log 'CONSULTA' for general requests.
  // Login/Logout will be logged explicitly in controller with specific actions.
  if (!req.path.startsWith("/auth/")) {
    // Avoid double logging auth requests if handled in controller
    const detalles = {
      query: req.query,
      body: req.body,
    };

    // Sanitize sensitive data from body if needed (e.g. passwords)
    // Create a shallow copy to avoid mutating the original request body
    if (detalles.body && detalles.body.password) {
      detalles.body = { ...detalles.body, password: "***" };
    }

    registrarLog(
      usuarioId,
      "CONSULTA",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      detalles
    );
  }

  next();
};

export default logRequest;
