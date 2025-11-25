import express from "express";
import {
  crearUsuario,
  login,
  recuperarAcceso,
  logout,
} from "../controller/usuarioController.js";
import protegerRuta from "../middleware/protegerRuta.js";

const router = express.Router();

// URL sin proteccion
router.post("/login", login);
router.post("/recuperar-acceso", recuperarAcceso);
router.post("/logout", protegerRuta, logout);

export default router;
