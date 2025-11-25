import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { CuentaModel } from "../models/index.js";
import registrarLog from "../utils/logger.js";

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
  const { email, password } = req.body;

  const Usuario = await CuentaModel.findOne({ where: { email } });

  if (!Usuario) return res.json({ resp: "Usuario incorrecto" });

  const password_compare = await bcrypt.compare(password, Usuario.password);

  if (password_compare) {
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

    return res.json({ token: token });
  } else return res.json({ resp: "Usuario incorrecto" });
};

const recuperarAcceso = async (req, res) => {
  const { email } = req.body;

  const Usuario = await CuentaModel.findOne({ where: { email } });

  if (!Usuario) {
    return res.json({ resp: "Correo electronico invalido" });
  }
  return res.json({
    resp: "Se ha enviado un correo de confirmación para recuperar su acceso",
  });
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

export { crearUsuario, login, recuperarAcceso, logout };
