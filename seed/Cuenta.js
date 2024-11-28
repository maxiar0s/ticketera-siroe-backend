import bcrypt from 'bcrypt';

const Cuentas = [
    {
        name: 'Jonathan',
        email: 'jonathan@siroe.com',
        telefono: 32156942,
        password: bcrypt.hashSync('password', 10)
    },
    {
        name: 'Ricardo',
        email: 'ricardo@siroe.com',
        telefono: 41567421,
        password: bcrypt.hashSync('password', 10)
    },
]

export default Cuentas;