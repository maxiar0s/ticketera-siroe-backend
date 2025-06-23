import bcrypt from "bcrypt";
import { col, fn, Op } from "sequelize";
import db from "../config/db.js";
import bucket from "../config/gcs.js";

import {
  CampoModel,
  CasaMatrizModel,
  CuentaModel,
  EquipoModel,
  EstadoCuentaModel,
  ObservacionModel,
  SucursalModel,
  TipoCuentaModel,
  TipoEquipoCampoModel,
  TipoEquipoModel,

  //?estado de equipos
  EstadoEquipoModel,
  //?estado de sucursales
  EstadoSucursalModel
} from "../models/index.js";
import EstadoCuenta from "../models/EstadoCuenta.js";

const generateSignedUrl = async (fileName) => {
  try {
    const file = bucket.file(fileName);
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
    });
    return url;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const postCuenta = async (req, res) => {
  const { name, telefono, email, password, tipoCuentaId } = req.body;
  const hashed_password = await bcrypt.hash(password, 10);
  const { id } = req.body;

  if (id) {
    let cuenta = await CuentaModel.findByPk(id, {
      include: [
        { model: TipoCuentaModel, as: "tipoCuenta" },
        { model: EstadoCuentaModel, as: "estadoCuenta" },
      ],
    });

    const { estadoCuentaId } = req.body;

    if (password == "") {
      cuenta.set({
        name,
        telefono,
        tipoCuentaId,
        estadoCuentaId,
      });

      await cuenta.save();

      cuenta = await CuentaModel.findByPk(id, {
        include: [
          { model: TipoCuentaModel, as: "tipoCuenta" },
          { model: EstadoCuentaModel, as: "estadoCuenta" },
        ],
      });

      return res.json(cuenta);
    } else {
      cuenta.set({
        name,
        telefono,
        tipoCuentaId,
        password: hashed_password,
        estadoCuentaId,
      });

      await cuenta.save();

      cuenta = await CuentaModel.findByPk(id, {
        include: [
          { model: TipoCuentaModel, as: "tipoCuenta" },
          { model: EstadoCuentaModel, as: "estadoCuenta" },
        ],
      });

      return res.json(cuenta);
    }
  } else {
    const correoExistente = await CuentaModel.findOne({
      where: {
        email,
      },
    });

    if (correoExistente) {
      return res.json({ error: "Correo electrónico ya registrado." });
    } else {
      const cuenta = await CuentaModel.create({
        name,
        telefono,
        email,
        tipoCuentaId,
        password: hashed_password,
        estadoCuentaId: 1,
      });

      return res.json(cuenta);
    }
  }
};

const getVerificarCorreo = async (req, res) => {
  const { correo } = req.query;

  const usuarioExistente = await CuentaModel.findOne({
    where: {
      email: correo,
    },
  });

  if (usuarioExistente) {
    return res.json({ isTaken: true });
  } else {
    return res.json({ isTaken: false });
  }
};

const postModificarCuenta = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.json({ resp: "Error al intentar modificar cuenta" });
  }

  const cuenta = await CuentaModel.findByPk(id);

  if (!cuenta) {
    return res.json({ resp: "Cuenta no encontrado, intente nuevamente" });
  }

  const { name, telefono, email, password } = req.body;

  const hashed_password = await bcrypt.hash(password, 10);

  cuenta.set({
    name,
    telefono,
    email,
    password: hashed_password,
  });
  cuenta.save();

  return res.json({ resp: "Cuenta modificado correctamente" });
};

const getEliminarCuenta = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.json({ resp: "No se ha encontrado un identificador unico" });
  }

  const cuenta = await CuentaModel.findByPk(id);

  if (!cuenta) {
    return res.json({ resp: "Cliente no encontrado, intente nuevamente" });
  }

  await cuenta.destroy();

  return res.json({ resp: "Cliente eliminado correctamente" });
};

const getUsuarios = async (req, res) => {
  let paginaActual = parseInt(req.query.pagina);
  const expresion = /^[1-999]$/;

  if (!expresion.test(paginaActual)) {
    paginaActual = 1;
  }

  // Limites y Offset para el paginador
  const limit = 12;
  const offset = (paginaActual - 1) * limit;

  const { option } = req.query;
  let tipoCuentaId = { [Op.in]: [1, 2, 3] };
  if (option === "Mesa de ayuda") {
    tipoCuentaId = 3;
  } else if (option === "Técnico de soporte") {
    tipoCuentaId = 2;
  } else if (option === "Administrador") {
    tipoCuentaId = 1;
  }

  const [cuentas, total] = await Promise.all([
    CuentaModel.scope("eliminarCampos").findAll({
      limit,
      offset,
      where: { tipoCuentaId },
      include: [
        { model: TipoCuentaModel, as: "tipoCuenta" },
        { model: EstadoCuenta, as: "estadoCuenta" },
      ],
      order: [["id", "ASC"]],
    }),
    CuentaModel.count({
      where: { tipoCuentaId },
    }),
  ]);

  let paginas = Math.ceil(total / limit);
  if (total == 0) {
    paginas = 1;
  }

  return res.json({ cuentas, paginas });
};

const getUsuario = async (req, res) => {
  const { id } = req.params;

  const usuario = await CuentaModel.scope("eliminarCampos").findByPk(id, {
    include: [
      { model: TipoCuentaModel, as: "tipoCuenta" },
      { model: EstadoCuentaModel, as: "estadoCuenta" },
    ],
  });

  if (!usuario) {
    return;
  }

  return res.json(usuario);
};

const postCliente = async (req, res) => {
  try {
    const { rut, razonSocial, encargadoGeneral, correo, telefonoEncargado } = req.body;
    const imagenName = req.uploadedFile;
    console.log('Valor de req.uploadedFile en postCliente:', imagenName);

    if (!rut || !razonSocial || !encargadoGeneral || !correo || telefonoEncargado === undefined) {
      return res.status(400).json({
        resp: "Error: Faltan campos requeridos",
        recibido: req.body
      });
    }

    const clienteExistente = await CasaMatrizModel.findOne({
      where: {
        rut,
      },
    });

    if (clienteExistente) {
      return res.status(400).json({ 
        resp: "Error: Ya existe un cliente con ese RUT" 
      });
    }

    // Procesar el número de teléfono
    let telefonoEncargadoNum = telefonoEncargado;
    if (typeof telefonoEncargado === 'string') {
      // Eliminar cualquier carácter no numérico
      const phoneNumber = telefonoEncargado.replace(/\D/g, '');
      telefonoEncargadoNum = parseInt(phoneNumber, 10);
    }

    // Validar que el número de teléfono sea válido (no más de 9 dígitos para Chile)
    if (isNaN(telefonoEncargadoNum) || telefonoEncargadoNum.toString().length > 9) {
      return res.status(400).json({ 
        resp: "Error: El número de teléfono no es válido", 
        recibido: telefonoEncargado 
      });
    }

    // Formatear el RUT
    const rutCasaMatriz = rut.toString().slice(0, 10);

    console.log('Datos a crear:', {
      rut: rutCasaMatriz,
      razonSocial,
      imagen: imagenName,
      encargadoGeneral,
      correo,
      telefonoEncargado: telefonoEncargadoNum
    });

    const nuevoCliente = await CasaMatrizModel.create({
      rut: rutCasaMatriz,
      razonSocial,
      imagen: imagenName,
      encargadoGeneral,
      correo,
      telefonoEncargado: telefonoEncargadoNum,
    });

    return res.json({ resp: "Cliente creado correctamente" });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    return res.status(500).json({ 
      resp: "Error al crear cliente", 
      error: error.message 
    });
  }
};

const postModificarCliente = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.json({ resp: "Error al intentar modificar cliente" });
    }

    const cliente = await CasaMatrizModel.findByPk(id);

    if (!cliente) {
      return res.json({ resp: "Cliente no encontrado, intente nuevamente" });
    }

    // Extraer los datos del cuerpo de la solicitud
    const { rut, razonSocial, encargadoGeneral, correo, telefonoEncargado } = req.body;

    // Verificar que todos los campos requeridos estén presentes
    if (!rut || !razonSocial || !encargadoGeneral || !correo || telefonoEncargado === undefined) {
      console.log('Datos recibidos:', req.body);
      return res.status(400).json({ 
        resp: "Error: Faltan campos requeridos", 
        recibido: req.body 
      });
    }

    // Asegurarse de que telefonoEncargado sea un número
    let telefonoEncargadoNum = telefonoEncargado;
    if (typeof telefonoEncargado === 'string') {
      // Eliminar cualquier carácter no numérico
      const phoneNumber = telefonoEncargado.replace(/\D/g, '');
      telefonoEncargadoNum = parseInt(phoneNumber, 10);
    }

    // Validar que el número de teléfono sea válido (no más de 9 dígitos para Chile)
    if (isNaN(telefonoEncargadoNum) || telefonoEncargadoNum.toString().length > 9) {
      return res.status(400).json({ 
        resp: "Error: El número de teléfono no es válido", 
        recibido: telefonoEncargado 
      });
    }

    // Actualizar solo los campos que están presentes
    const updateData = {};
    if (rut) updateData.rut = rut;
    if (razonSocial) updateData.razonSocial = razonSocial;
    if (encargadoGeneral) updateData.encargadoGeneral = encargadoGeneral;
    if (correo) updateData.correo = correo;
    if (telefonoEncargadoNum) updateData.telefonoEncargado = telefonoEncargadoNum;

    // Si se subió una nueva imagen, actualizar el campo imagen
    if (req.uploadedFile) {
      updateData.imagen = req.uploadedFile;
      console.log('Nueva imagen subida en modificación:', req.uploadedFile);
    }

    console.log('Datos a actualizar:', updateData);

    // Actualizar el cliente
    await cliente.update(updateData);

    return res.json({ resp: "Cliente modificado correctamente" });
  } catch (error) {
    console.error('Error al modificar cliente:', error);
    return res.status(500).json({ 
      resp: "Error al modificar cliente", 
      error: error.message 
    });
  }
};

const postEliminarCliente = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.json({ resp: "Error al intentar eliminar cliente" });
  }

  try {
    // Buscar el cliente sin incluir asociaciones para evitar el error
    const cliente = await CasaMatrizModel.findByPk(id);

    if (!cliente) {
      return res.json({ resp: "Cliente no encontrado, intente nuevamente" });
    }

    // Buscar y eliminar equipos asociados al cliente
    const equiposAsociados = await EquipoModel.findAll({
      where: { casaMatrizId: id }
    });

    if (equiposAsociados && equiposAsociados.length > 0) {
      for (const equipo of equiposAsociados) {
        await equipo.destroy();
      }
    }

    // Eliminar el cliente
    await cliente.destroy();

    return res.json({ 
      resp: "Cliente eliminado correctamente",
      success: true,
      clienteId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    return res.status(500).json({ 
      resp: "Error al eliminar cliente", 
      error: error.message,
      success: false
    });
  }
};

const postSucursal = async (req, res) => {
  const {
    encargadoSucursal,
    correoSucursal,
    telefonoSucursal,
    sucursal,
    direccion,
    sucursalId,
    casaMatrizId,
  } = req.body;

  const telefonoSinEspacios = telefonoSucursal.replace(/\s+/g, "");
  const telefonoSucursalFormateado = telefonoSinEspacios.toString().slice(0, 9);
  const sucursalNombre = sucursal;

  if (!casaMatrizId && !sucursalId) return;

  if (sucursalId) {
    const sucursal = await SucursalModel.findByPk(sucursalId);

    sucursal.set({
      sucursal: sucursalNombre,
      encargadoSucursal,
      correoSucursal,
      telefonoSucursal: telefonoSucursalFormateado,
      direccion,
    });

    await sucursal.save();

    const sucursalModificada = await SucursalModel.findByPk(sucursalId, {
      include: [{ model: EquipoModel, as: "equipos", attributes: [] }],
      attributes: {
        include: [[fn("COUNT", col("equipos.id")), "equiposCount"]],
      },
      group: ["Sucursales.id"],
      subQuery: false,
    });

    return res.json({ resp: "mod", sucursal: sucursalModificada });
  } else {
    const nuevaSucursal = await SucursalModel.create({
      encargadoSucursal,
      correoSucursal,
      estado: 1,
      telefonoSucursal: telefonoSucursalFormateado,
      sucursal,
      direccion,
      casaMatrizId,
    });

    return res.json({ resp: "creada", sucursal: nuevaSucursal });
  }
};

const getEliminarSucursal = async (req, res) => {
  const { id } = req.params;

  if (!id) return;

  const sucursal = await SucursalModel.findByPk(id);

  if (!sucursal) return;

  await sucursal.destroy();

  return res.json({ resp: "Sucursal eliminada exitosamente." });
};

const postEquipo = async (req, res) => {
  const {
    clienteId = null,
    sucursalId = null,
    departamento,
    tipoEquipoId,
  } = req.body;

  if (!clienteId && !sucursalId) {
    return res
      .status(400)
      .json({ error: "Debe proporcionar un clienteId o sucursalId" });
  }

  const t = await db.transaction();

  try {
    const lockCondition = sucursalId ? { sucursalId } : { clienteId };

    const ultimoEquipo = await EquipoModel.findOne({
      where: lockCondition,
      order: [["numeroSecuencial", "DESC"]],
      lock: true,
      skipLocked: false,
      transaction: t,
    });

    const maxNumero = ultimoEquipo ? ultimoEquipo.numeroSecuencial : 0;
    const nextNumero = maxNumero + 1;

    const tipoEquipo = await TipoEquipoModel.findOne({
      where: { id: tipoEquipoId },
      transaction: t,
    });

    if (!tipoEquipo) {
      throw new Error("El tipo de equipo no existe");
    }

    // Crear el código del equipo
    const deptCode = departamento.substring(0, 4).toUpperCase();
    const numeroPadded = nextNumero.toString().padStart(3, "0");
    const codigoId = `SI${deptCode}${tipoEquipo.dict}${numeroPadded}`;

    // Crear el nuevo equipo
    const nuevoEquipo = await EquipoModel.create(
      {
        numeroSecuencial: nextNumero,
        casaMatrizId: null,
        clienteId,
        sucursalId,
        estado: 1,
        marca: req.body.marca || null,
        modelo: req.body.modelo || null,
        codigoId,
        departamento,
        numeroSerie: req.body.numeroSerie || null,
        procesador: req.body.procesador || null,
        velocidadProcesador: req.body.velocidadProcesador || null,
        ram: req.body.ram || null,
        tipoAlmacenamiento: req.body.tipoAlmacenamiento || null,
        cantidadAlmacenamiento: req.body.cantidadAlmacenamiento || null,
        sistemaOperativo: req.body.sistemaOperativo || null,
        ofimatica: req.body.ofimatica || null,
        antivirus: req.body.antivirus || null,
        tipoEquipoId: tipoEquipo.id,
      },
      { transaction: t }
    );

    await t.commit();
    return res.json({
      message: "Equipo creado satisfactoriamente",
      nuevoEquipo,
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error(error);
    return res
      .status(500)
      .json({ error: "Error al crear el equipo", details: error.message });
  }
};

const postObservacion = async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  const observacion = await ObservacionModel.create({
    text,
    equipoId: id,
  });

  return res.json(observacion);
};

const postModificarEquipo = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.json({ resp: "Error al intentar modificar el equipo" });
  }

  const equipo = await EquipoModel.findByPk(id);

  if (!equipo) {
    return res.json({ resp: "Equipo no encontrado, intente nuevamente" });
  }

  const {
    marca,
    modelo,
    numeroSerie,
    usuario,
    procesador,
    velocidadProcesador,
    ram,
    tipoAlmacenamiento,
    cantidadAlmacenamiento,
    sistemaOperativo,
    ofimatica,
    antivirus,
  } = req.body;

  if (req.uploadedFile) {
    const imagenName = req.uploadedFile;

    equipo.set({
      marca,
      modelo,
      imagen: imagenName,
      usuario,
      numeroSerie,
      procesador,
      velocidadProcesador,
      ram,
      tipoAlmacenamiento,
      cantidadAlmacenamiento,
      sistemaOperativo,
      ofimatica,
      antivirus,
    });
  }

  equipo.set({
    marca,
    modelo,
    numeroSerie,
    procesador,
    velocidadProcesador,
    ram,
    tipoAlmacenamiento,
    cantidadAlmacenamiento,
    sistemaOperativo,
    ofimatica,
    antivirus,
  });

  equipo.save();

  return res.json({ resp: "Equipo modificado correctamente." });
};

const deleteEquiptment = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Error: No se proporcionó un ID de equipo válido",
    });
  }

  try {
    // Find the equipment by ID
    const equipo = await EquipoModel.findByPk(id);

    if (!equipo) {
      return res.status(404).json({
        success: false,
        message: "Equipo no encontrado, intente nuevamente",
      });
    }

    // Check if there are any related observations
    const observaciones = await ObservacionModel.findAll({
      where: { equipoId: id },
    });

    // Start a transaction to ensure data integrity
    const t = await db.transaction();

    try {
      // Delete all related observations first
      if (observaciones.length > 0) {
        await ObservacionModel.destroy({
          where: { equipoId: id },
          transaction: t,
        });
      }

      // Delete the equipment
      await equipo.destroy({ transaction: t });

      // Commit the transaction
      await t.commit();

      return res.json({
        success: true,
        message: "Equipo eliminado correctamente",
      });
    } catch (error) {
      // Rollback in case of error
      await t.rollback();
      console.error("Error al eliminar el equipo:", error);

      return res.status(500).json({
        success: false,
        message: "Error al eliminar el equipo",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Error al buscar el equipo:", error);

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};

const getResults = async (req, res) => {
  let paginaActual = parseInt(req.query.pagina);
  const expresion = /^[1-999]$/;

  if (!expresion.test(paginaActual)) {
    return;
  }

  // Limites y Offset para el paginador
  const limit = 8;
  const offset = (paginaActual - 1) * limit;

  const [clientes, total] = await Promise.all([
    CasaMatrizModel.findAll({
      limit,
      offset,
    }),
    CasaMatrizModel.count(),
  ]);

  let paginas = Math.ceil(total / limit);
  if (total == 0) {
    paginas = 1;
  }

  res.json({ clientes, paginas });
};

const getClientById = async (req, res) => {
  let paginaActual = parseInt(req.query.pagina);
  const expresion = /^[1-999]$/;

  if (!expresion.test(paginaActual)) {
    paginaActual = 1;
  }

  // Limites y Offset para el paginador
  const limit = 5;
  const offset = (paginaActual - 1) * limit;

  const { id } = req.params;
  const { option } = req.query;
  let estado = { [Op.in]: [1, 2, 3] };
  if (option === "Terminados") {
    estado = 3;
  } else if (option === "Pendientes") {
    estado = 2;
  }

  const [cliente, total] = await Promise.all([
    CasaMatrizModel.findByPk(id, {
      include: [
        {
          model: SucursalModel,
          as: "sucursales",
          limit,
          offset,
          where: { estado },
          include: [{ model: EquipoModel, as: "equipos", attributes: [] }],
          order: [["fechaIngreso", "DESC"]],
          attributes: {
            include: [[fn("COUNT", col("equipos.id")), "equiposCount"]],
          },
          group: ["Sucursales.id"],
          subQuery: false,
        },
      ],
    }),
    CasaMatrizModel.count({
      where: { id },
      include: [{ model: SucursalModel, as: "sucursales", where: { estado } }],
    }),
  ]);

  let paginas = Math.ceil(total / limit);
  if (total == 0) {
    paginas = 1;
  }

  return res.json({ cliente, paginas });
};

const getSucursalById = async (req, res) => {
  let paginaActual = parseInt(req.query.pagina);
  const expresion = /^[1-999]$/;

  if (!expresion.test(paginaActual)) {
    paginaActual = 1;
  }

  // Limites y Offset para el paginador
  const limit = 8;
  const offset = (paginaActual - 1) * limit;

  const { id } = req.params;
  const { option, sort } = req.query;
  let estado = { [Op.in]: [1, 2, 3] };
  if (option === "Terminados") {
    estado = 3;
  } else if (option === "Pendientes") {
    estado = 2;
  }

  // Determine sort order based on query parameter
  const sortOrder = sort === 'asc' ? 'ASC' : 'DESC';

  const [sucursal, total] = await Promise.all([
    SucursalModel.findByPk(id, {
      include: [
        { model: CasaMatrizModel, as: "casaMatriz" },
        {
          model: EquipoModel,
          as: "equipos",
          limit,
          offset,
          include: [
            { model: TipoEquipoModel, as: "tipoEquipo" },
            { model: ObservacionModel, as: "observaciones" },
          ],
          where: { estado },
          order: [["numeroSecuencial", sortOrder]],
        },
      ],
    }),
    SucursalModel.count({
      where: {
        id,
      },
      include: [{ model: EquipoModel, as: "equipos", where: { estado } }],
    }),
  ]);

  let paginas = Math.ceil(total / limit);
  if (total == 0) {
    paginas = 1;
  }

  return res.json({ sucursal, paginas });
};

const getEquipmentsByCasaMatriz = async (req, res) => {
  const { id } = req.params;
  const equipos = await EquipoModel.findAll({
    where: {
      casaMatrizId: id,
    },
    include: [{ model: CasaMatrizModel, as: "casaMatriz" }],
  });
  if (!equipos) {
    return;
  }
  res.json(equipos);
};

const getTypeEquipments = async (req, res) => {
  const tipos = await TipoEquipoModel.findAll();

  res.json(tipos);
};

const getEquipmentForm = async (req, res) => {
  const { id } = req.params;

  try {
    const campos = await TipoEquipoCampoModel.findAll({
      where: {
        tipoEquipoId: id,
      },
      include: [{ model: CampoModel, as: "campo" }],
    });

    const camposTransformados = campos.map(({ campo }) => ({
      id: campo.id,
      name: campo.name,
      label: campo.label,
      type: campo.type,
      placeholder: campo.placeholder,
      required: campo.required,
    }));

    res.json(camposTransformados);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener los campos" });
  }
};

const getEquipmentById = async (req, res) => {
  const { id } = req.params;
  const equipo = await EquipoModel.findByPk(id, {
    include: [
      { model: TipoEquipoModel, as: "tipoEquipo" },
      { model: CasaMatrizModel, as: "casaMatriz" },
      { model: SucursalModel, as: "sucursal" },
    ],
  });

  if (!equipo) {
    return;
  }
  res.json(equipo);
};

//?get estado de equipos
const getEstadosEquipo = async (req, res) => {
  try {
      const estados = await EstadoEquipoModel.findAll();
      res.json(estados);
  } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'Hubo un error al obtener los estados de equipos' });
  }
};

//? Actualizar el estado de un equipo
const actualizarEstadoEquipo = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
      const equipo = await EquipoModel.findByPk(id);
      
      if (!equipo) {
          return res.status(404).json({ msg: 'Equipo no encontrado' });
      }

      // Verificar que el estado exista
      const estadoExiste = await EstadoEquipoModel.findByPk(estado);
      if (!estadoExiste) {
          return res.status(400).json({ msg: 'Estado de equipo no válido' });
      }

      // Actualizar el estado
      equipo.estado = estado;
      await equipo.save();

      res.json({ msg: 'Estado de equipo actualizado correctamente' });
  } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'Hubo un error al actualizar el estado del equipo' });
  }
};

//? Actualizar solo el estado de un equipo (POST)
const actualizarSoloEstadoEquipo = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
      const equipo = await EquipoModel.findByPk(id);
      
      if (!equipo) {
          return res.status(404).json({ msg: 'Equipo no encontrado' });
      }

      // Verificar que el estado exista
      const estadoExiste = await EstadoEquipoModel.findByPk(estado);
      if (!estadoExiste) {
          return res.status(400).json({ msg: 'Estado de equipo no válido' });
      }

      // Actualizar SOLO el estado usando update en lugar de save
      await EquipoModel.update(
          { estado: estado },
          { where: { id: id } }
      );

      res.json({ msg: 'Estado de equipo actualizado correctamente' });
  } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'Hubo un error al actualizar el estado del equipo' });
  }
};

const generarUrl = async (req, res) => {
  const { fileName } = req.params;
  try {
    const signedUrl = await generateSignedUrl(fileName);
    res.json({ signedUrl });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Error al generar la URL firmada' });
  }
};

//?get estado de sucursales
const getEstadosSucursal = async (req, res) => {
  try {
      const estados = await EstadoSucursalModel.findAll();
      res.json(estados);
  } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'Hubo un error al obtener los estados de sucursales' });
  }
};

//? Actualizar el estado de una sucursal
const actualizarEstadoSucursal = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
      const sucursal = await SucursalModel.findByPk(id);
      
      if (!sucursal) {
          return res.status(404).json({ msg: 'Sucursal no encontrada' });
      }

      // Verificar que el estado exista
      const estadoExiste = await EstadoSucursalModel.findByPk(estado);
      if (!estadoExiste) {
          return res.status(400).json({ msg: 'Estado de sucursal no válido' });
      }

      // Actualizar SOLO el estado usando update en lugar de save
      await SucursalModel.update(
          { estado: estado },
          { where: { id: id } }
      );

      res.json({ msg: 'Estado de sucursal actualizado correctamente' });
  } catch (error) {
      console.log(error);
      res.status(500).json({ msg: 'Hubo un error al actualizar el estado de la sucursal' });
  }
};

export {
  postCuenta,
  getVerificarCorreo,
  postModificarCuenta,
  getEliminarCuenta,
  getUsuarios,
  getUsuario,
  postCliente,
  postModificarCliente,
  postEliminarCliente,
  postSucursal,
  getEliminarSucursal,
  postEquipo,
  postObservacion,
  postModificarEquipo,
  deleteEquiptment,
  getResults,
  getClientById,
  getTypeEquipments,
  getEquipmentForm,
  getSucursalById,
  getEquipmentsByCasaMatriz,
  getEquipmentById,
  generarUrl,
  //? Estados de equipos
  getEstadosEquipo,
  actualizarEstadoEquipo,
  actualizarSoloEstadoEquipo,
  //? Estados de sucursales
  getEstadosSucursal,
  actualizarEstadoSucursal
};
