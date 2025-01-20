import bcrypt from 'bcrypt';

const Cuentas = [
    {
        name: 'Jonathan',
        email: 'jmunoz@siroe.cl',
        telefono: 968708503,
        password: bcrypt.hashSync('password', 10),
        tipoCuentaId: 1,
        estadoCuentaId: 1
    },
]

export default Cuentas;