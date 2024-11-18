import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { usuario } from '../models/index.js';

const crearUsuario = async (req, res) => {
    const {
        name,
        email,
        password
    } = req.body;

    const usuarioExistente = await usuario.findOne({
        where: {
            email
        }
    });
    if(usuarioExistente) {
        return res.json({ resp: 'Correo electronico ya registrado.'});
    }
    console.log('asdasdas')
    const hashed_password = await bcrypt.hash(password, 10);
    const Usuario = await usuario.create({
        name,
        email,
        password: hashed_password
    });
    return res.json({ resp: 'Usuario creado con exito.'});
}

const login = async (req, res) => {
    const {
        email,
        password
    } = req.body;

    const Usuario = await usuario.findOne({ where: { email }});

    if(!Usuario) {
        return res.json({resp: 'correo electronico o contraseña invalida'});
    }
    const password_compare = await bcrypt.compare(password, Usuario.password);
    if(password_compare){
        const token = jwt.sign({ id: Usuario.id }, process.env.JWT_SECRETPASSWORD);
        return res.json({resp: 'Ingresado correctamente', token});
    } else {
        return res.json({resp: 'correo electronico o contraseña invalida'});
    }
}

const recuperarAcceso = async (req, res) => {
    const { email } = req.body;

    const Usuario = await usuario.findOne({ where: { email }});

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