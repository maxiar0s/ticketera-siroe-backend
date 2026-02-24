import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { CuentaModel } from "../models/index.js";
import registrarLog from "../utils/logger.js";

const RESET_PASSWORD_EXPIRES_IN = "20m";

const getResetSecret = () => {
  return process.env.PASSWORD_RESET_SECRET || process.env.JWT_SECRETPASSWORD;
};

const getResetTransporter = () => {
  const host = process.env.TICKET_OUTBOUND_SMTP_HOST || process.env.SMTP_HOST;
  const user = process.env.TICKET_OUTBOUND_SMTP_USER || process.env.SMTP_USER;
  const pass =
    process.env.TICKET_OUTBOUND_SMTP_PASSWORD || process.env.SMTP_PASS;
  const port = Number.parseInt(
    process.env.TICKET_OUTBOUND_SMTP_PORT || process.env.SMTP_PORT || "587",
    10
  );
  const secureSetting =
    process.env.TICKET_OUTBOUND_SMTP_SECURE || process.env.SMTP_SECURE;
  const secure = `${secureSetting || "false"}`.toLowerCase() === "true";

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

const buildResetEmailHtml = (resetLink, userName = "") => {
  const saludo = userName?.trim() ? `Hola ${userName.trim()},` : "Hola,";
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperar contrasena</title>
</head>
<body style="font-family: Arial, sans-serif; background:#f7f7f7; margin:0; padding:24px; color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; padding:24px;">
    <tr>
      <td>
        <h2 style="margin-top:0;">Recuperacion de contrasena</h2>
        <p>${saludo}</p>
        <p>Recibimos una solicitud para restablecer tu contrasena en Soporte Siroe.</p>
        <p>Haz clic en el siguiente boton para crear una nueva contrasena:</p>
        <p style="margin:24px 0;">
          <a href="${resetLink}" style="background:#0f766e; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:6px; display:inline-block;">
            Restablecer contrasena
          </a>
        </p>
        <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
        <p>Este enlace expira en 20 minutos.</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

const crearUsuario = async (req, res) => {
  const { name, email, telefono, tipo, password } = req.body;

  const emailRegistrado = await CuentaModel.findOne({
    where: {
      email,
    },
  });

  if (emailRegistrado) {
    return res.json({ resp: "Correo electronico ya registrado." });
  }

  const hashed_password = await bcrypt.hash(password, 10);
  const Usuario = await CuentaModel.create({
    name,
    email,
    telefono,
    tipo,
    password: hashed_password,
  });

  return res.json({ resp: "Usuario creado con exito." });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ resp: "Debe ingresar correo y contraseña" });
    }

    const Usuario = await CuentaModel.findOne({ where: { email } });

    if (!Usuario) {
      return res.status(401).json({ resp: "Usuario o contraseña incorrecta" });
    }

    const password_compare = await bcrypt.compare(password, Usuario.password);

    if (!password_compare) {
      return res.status(401).json({ resp: "Usuario o contraseña incorrecta" });
    }

    if (!process.env.JWT_SECRETPASSWORD) {
      console.error("JWT_SECRETPASSWORD no está definido");
      return res
        .status(500)
        .json({ resp: "Error de configuración, contacte al administrador" });
    }

    const token = jwt.sign(
      { id: Usuario.id, tipoCuenta: Usuario.tipoCuentaId },
      process.env.JWT_SECRETPASSWORD,
      { expiresIn: "7d" }
    );

    // Registrar log de login
    await registrarLog(
      Usuario.id,
      "LOGIN",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { email: Usuario.email }
    );

    return res.json({ token });
  } catch (error) {
    console.error("Error en login:", error);
    return res
      .status(500)
      .json({ resp: "No se pudo iniciar sesión, intente nuevamente" });
  }
};

const recuperarAcceso = async (req, res) => {
  try {
    const email = `${req.body?.email || ""}`.trim().toLowerCase();
    if (!email) {
      return res
        .status(400)
        .json({ resp: "Debe ingresar un correo electronico valido." });
    }

    const cuenta = await CuentaModel.findOne({ where: { email } });

    if (!cuenta) {
      return res.json({
        resp: "Si el correo existe, te enviaremos instrucciones para recuperar tu acceso.",
      });
    }

    const resetSecret = getResetSecret();
    if (!resetSecret) {
      console.error(
        "No existe secreto para recuperar contrasena (PASSWORD_RESET_SECRET/JWT_SECRETPASSWORD)."
      );
      return res
        .status(500)
        .json({ resp: "No fue posible procesar la solicitud." });
    }

    const transporter = getResetTransporter();
    if (!transporter) {
      console.error(
        "SMTP no configurado para recuperar contrasena (TICKET_OUTBOUND_SMTP_* o SMTP_*)."
      );
      return res
        .status(500)
        .json({ resp: "No fue posible enviar el correo de recuperacion." });
    }

    const resetToken = jwt.sign(
      { id: cuenta.id, purpose: "reset-password" },
      resetSecret,
      { expiresIn: RESET_PASSWORD_EXPIRES_IN }
    );

    cuenta.token = resetToken;
    await cuenta.save();

    const frontendUrl =
      process.env.FRONTEND_URL || "https://app.soportesiroe.cl";
    const resetLink = `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(
      resetToken
    )}`;

    const fromAddress =
      process.env.TICKET_OUTBOUND_FROM_ADDRESS ||
      process.env.TICKET_OUTBOUND_SMTP_USER ||
      process.env.SMTP_USER;
    const fromName = process.env.TICKET_OUTBOUND_FROM_NAME || "Soporte Siroe";

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: cuenta.email,
      subject: "Recuperacion de contrasena - Soporte Siroe",
      html: buildResetEmailHtml(resetLink, cuenta.name),
    });

    return res.json({
      resp: "Si el correo existe, te enviaremos instrucciones para recuperar tu acceso.",
    });
  } catch (error) {
    console.error("Error al recuperar acceso:", error);
    return res
      .status(500)
      .json({ resp: "No fue posible procesar la solicitud." });
  }
};

const restablecerContrasena = async (req, res) => {
  try {
    const token = `${req.body?.token || ""}`.trim();
    const nuevaContrasena = `${req.body?.password || ""}`;

    if (!token || !nuevaContrasena) {
      return res
        .status(400)
        .json({ resp: "Token y nueva contrasena son obligatorios." });
    }

    if (nuevaContrasena.length < 8) {
      return res
        .status(400)
        .json({ resp: "La contrasena debe tener al menos 8 caracteres." });
    }

    const resetSecret = getResetSecret();
    if (!resetSecret) {
      return res
        .status(500)
        .json({ resp: "No fue posible validar la solicitud." });
    }

    const payload = jwt.verify(token, resetSecret);
    if (payload?.purpose !== "reset-password" || !payload?.id) {
      return res.status(400).json({ resp: "Token invalido." });
    }

    const cuenta = await CuentaModel.findByPk(payload.id);
    if (!cuenta || cuenta.token !== token) {
      return res.status(400).json({ resp: "Token invalido o expirado." });
    }

    cuenta.password = await bcrypt.hash(nuevaContrasena, 10);
    cuenta.token = null;
    await cuenta.save();

    return res.json({ resp: "Contrasena restablecida correctamente." });
  } catch (error) {
    console.error("Error al restablecer contrasena:", error);
    return res
      .status(400)
      .json({ resp: "Token invalido o expirado. Solicita un nuevo enlace." });
  }
};

const logout = async (req, res) => {
  // Registrar log de logout
  if (req.usuario) {
    await registrarLog(
      req.usuario.id,
      "LOGOUT",
      req.method,
      req.path,
      req.ip || req.connection.remoteAddress,
      { email: req.usuario.email }
    );
  }
  return res.json({ resp: "Sesión cerrada exitosamente" });
};

export { crearUsuario, login, recuperarAcceso, restablecerContrasena, logout };
