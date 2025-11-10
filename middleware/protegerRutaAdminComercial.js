import jwt from 'jsonwebtoken';
import { CuentaModel } from '../models/index.js';

const PERMISOS_DOCUMENTACION = [1, 5];

const protegerRutaAdminComercial = async (req, res, next) => {
  try {
    const header = req.headers['token'];
    const token = header && header.split(' ')[1];

    if (!token) {
      const error = new Error('No se proporcionó un token');
      error.status = 401;
      throw error;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRETPASSWORD);
    const { id } = decoded;
    const cuenta = await CuentaModel.findByPk(id);

    if (!cuenta) {
      const error = new Error('Usuario no encontrado');
      error.status = 404;
      throw error;
    }

    if (!PERMISOS_DOCUMENTACION.includes(cuenta.tipoCuentaId)) {
      const error = new Error('No tiene permisos para acceder a esta sección');
      error.status = 403;
      throw error;
    }

    req.usuario = cuenta;
    next();
  } catch (error) {
    res.status(error.status || 500).json({
      mensaje: error.message || 'Ocurrió un error inesperado',
    });
  }
};

export default protegerRutaAdminComercial;
