import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { CuentaModel } from '../models/index.js';

const crearUsuario = async (req, res) => {
    const {
        name,
        email,
        telefono,
        tipo,
        password,
    } = req.body;

    const emailRegistrado = await CuentaModel.findOne({
        where: {
            email
        }
    });

    if(emailRegistrado) {
        return res.json({ resp: 'Correo electronico ya registrado.'});
    }

    const hashed_password = await bcrypt.hash(password, 10);
    const Usuario = await CuentaModel.create({
        name,
        email,
        telefono,
        tipo,
        password: hashed_password
    });
    
    return res.json({ resp: 'Usuario creado con exito.'});
}

const login = async (req, res) => {
    const {
        email,
        password
    } = req.body;

    const Usuario = await CuentaModel.findOne({ where: { email }});

    if(!Usuario) return res.json({resp: 'Usuario incorrecto'});

    const password_compare = await bcrypt.compare(password, Usuario.password);

    if(password_compare){
        const token = jwt.sign({ id: Usuario.id }, process.env.JWT_SECRETPASSWORD, { expiresIn: '7d' });
        return res.json({token: token});
    } else return res.json({resp: 'Usuario incorrecto'});
}

const recuperarAcceso = async (req, res) => {
    const { email } = req.body;

    const Usuario = await CuentaModel.findOne({ where: { email }});

    if(!Usuario) {
        return res.json({resp: 'Correo electronico invalido'});
    }
    return res.json({resp: 'Se ha enviado un correo de confirmación para recuperar su acceso'});
}

export {
    crearUsuario,
    login,
    recuperarAcceso,
}