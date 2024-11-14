import express from "express";
import db from "./config/db.js";
import apiRoutes from './routes/apiRoutes.js'
import usuarioRoutes from './routes/usuarioRoutes.js'

const app =  express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexión a DB
try {
    await db.authenticate();
    await db.sync();
    console.log('Conexion a la base datos establecida');
} catch (error) {
    console.log(error);
}

app.use("/auth/", usuarioRoutes)
app.use("/", apiRoutes)

const port = 3000;
app.listen(port, () => {
    console.log(`El servidor se esta ejecutando en el servidor ${port}`);
})