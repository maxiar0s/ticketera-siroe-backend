import jwt from 'jsonwebtoken'

const protegerRuta = async (req, res, next) => {

    const header = req.headers['token'];
    const token = header && header.split(' ')[1];
    if (!token) return res.sendStatus(401);

    // Comprobar el Token
    try {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        })
        return next()
    } catch (error) {
        console.log(error);
    }
}

export default protegerRuta