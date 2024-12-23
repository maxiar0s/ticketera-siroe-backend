import jwt from 'jsonwebtoken';
import { CuentaModel } from '../models/index.js'

const protegerRutaTecnico = async (req, res, next) => {
    const header = req.headers['token'];
    const token = header && header.split(' ')[1];
    if(!token) return;
    // Comprobar el Token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRETPASSWORD);
        const { id } = decoded;
        const cuenta = await CuentaModel.findByPk(id);
        if(!cuenta) return;
        console.log(cuenta);
        req.usuario = cuenta;
        next();
    } catch (error) {
        console.log(error);
    }
}

export default protegerRutaTecnico