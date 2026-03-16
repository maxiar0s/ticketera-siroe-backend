import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import bucket from "../config/gcs.js";

const upload = multer({
  storage: multer.memoryStorage(),
});

const uploadToGCS = async (file) => {
  const typeFile = file.originalname.split(".");
  const ext = typeFile.length > 1 ? typeFile[typeFile.length - 1] : "";
  const blob = bucket.file(`${uuidv4()}.${ext}`);
  const stream = blob.createWriteStream({
    metadata: { contentType: file.mimetype },
  });

  return new Promise((resolve, reject) => {
    stream.on("error", reject);
    stream.on("finish", async () => {
      resolve(blob.name);
    });
    stream.end(file.buffer);
  });
};

// single image compatibility
export const handleUpload = upload.single("imagen");
export const processFile = async (req, res, next) => {
  try {
    if (!req.file) {
      console.log("No se proporcionó ningún archivo, continuando...");
      return next();
    }

    console.log("Archivo recibido en processFile:", req.file.originalname);

    const fileName = await uploadToGCS(req.file);
    console.log("Nombre de archivo subido a GCS:", fileName);
    req.uploadedFile = fileName;
    next();
  } catch (error) {
    console.log(error);
    next();
  }
};

export const handleDocumentoCliente = upload.single("archivo");
export const processDocumentoCliente = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    const storageName = await uploadToGCS(req.file);
    req.documentoClienteArchivo = {
      storageName,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    };
    next();
  } catch (error) {
    console.error("Error subiendo documento de cliente:", error);
    next();
  }
};

// multiple files support for bitacoras
export const handleFiles = upload.fields([
  { name: "files", maxCount: 20 },
  { name: "evidenceFiles", maxCount: 20 },
]);
export const processFiles = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log(
        "No se proporcionaron archivos (files/evidenceFiles), continuando...",
      );
      return next();
    }

    const procesarCampo = async (campo) => {
      const list = req.files?.[campo];
      if (!Array.isArray(list) || list.length === 0) {
        return [];
      }

      const subidos = [];
      for (const file of list) {
        try {
          const name = await uploadToGCS(file);
          subidos.push(name);
        } catch (err) {
          console.error(`Error subiendo archivo (${campo}) a GCS:`, err);
        }
      }
      return subidos;
    };

    const adjuntosIngreso = await procesarCampo("files");
    const adjuntosEvidencia = await procesarCampo("evidenceFiles");

    if (adjuntosIngreso.length) {
      console.log("Archivos de ingreso subidos a GCS:", adjuntosIngreso);
      req.uploadedFiles = adjuntosIngreso;
    }
    if (adjuntosEvidencia.length) {
      console.log("Archivos de evidencia subidos a GCS:", adjuntosEvidencia);
      req.uploadedEvidenceFiles = adjuntosEvidencia;
    }

    next();
  } catch (error) {
    console.log(error);
    next();
  }
};

export const handleProjectAssets = upload.fields([
  { name: "foto", maxCount: 1 },
  { name: "archivos", maxCount: 20 },
]);

export const processProjectAssets = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return next();
    }

    const procesarLista = async (lista) => {
      if (!Array.isArray(lista) || lista.length === 0) {
        return [];
      }

      const resultados = [];
      for (const file of lista) {
        try {
          const storageName = await uploadToGCS(file);
          resultados.push({
            storageName,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          });
        } catch (err) {
          console.error("Error subiendo archivo de proyecto a GCS:", err);
        }
      }
      return resultados;
    };

    if (Array.isArray(req.files.foto) && req.files.foto.length) {
      const fotoProcesada = await procesarLista([req.files.foto[0]]);
      if (fotoProcesada.length) {
        req.projectFoto = fotoProcesada[0];
      }
    }

    if (Array.isArray(req.files.archivos) && req.files.archivos.length) {
      const archivosProcesados = await procesarLista(req.files.archivos);
      if (archivosProcesados.length) {
        req.projectArchivos = archivosProcesados;
      }
    }

    next();
  } catch (error) {
    console.log(error);
    next();
  }
};

export const handleVehiculoSalidaArchivos = upload.fields([
  { name: "adjuntos", maxCount: 20 },
  { name: "comprobante", maxCount: 5 },
]);

export const processVehiculoSalidaArchivos = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return next();
    }

    const procesarLista = async (campo) => {
      const lista = req.files?.[campo];
      if (!Array.isArray(lista) || lista.length === 0) {
        return [];
      }

      const resultados = [];
      for (const file of lista) {
        try {
          const storageName = await uploadToGCS(file);
          resultados.push({
            storageName,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          });
        } catch (err) {
          console.error(
            `Error subiendo archivo (${campo}) de salida de vehículo a GCS:`,
            err,
          );
        }
      }
      return resultados;
    };

    const adjuntos = await procesarLista("adjuntos");
    const comprobantes = await procesarLista("comprobante");

    if (adjuntos.length) {
      req.vehiculoSalidaAdjuntos = adjuntos;
    }
    if (comprobantes.length) {
      req.vehiculoSalidaComprobante = comprobantes;
    }

    next();
  } catch (error) {
    console.error("Error procesando archivos de salida de vehículo:", error);
    next();
  }
};

// Handler para cliente con imagen y logoPerfil
export const handleClienteImages = upload.fields([
  { name: "imagen", maxCount: 1 },
  { name: "logoPerfil", maxCount: 1 },
]);

export const processClienteImages = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log("No se proporcionaron archivos de cliente, continuando...");
      return next();
    }

    if (req.files.imagen?.[0]) {
      const imageName = await uploadToGCS(req.files.imagen[0]);
      console.log("Imagen de cliente subida a GCS:", imageName);
      req.uploadedFile = imageName;
    }

    if (req.files.logoPerfil?.[0]) {
      const logoName = await uploadToGCS(req.files.logoPerfil[0]);
      console.log("Logo de perfil subido a GCS:", logoName);
      req.uploadedLogoPerfil = logoName;
    }

    next();
  } catch (error) {
    console.error("Error procesando imágenes de cliente:", error);
    next();
  }
};

// Biblioteca (Acepta campos dinámicos files_*)
// Usamos upload.any() para aceptar cualquier campo que comience con "files_"
export const handleBibliotecaAssets = upload.any();

// Procesa archivos de biblioteca y los agrupa por sección en req.bibliotecaFiles
export const processBibliotecaAssets = async (req, res, next) => {
  try {
    // Filtrar solo archivos que comiencen con "files_"
    const archivos = Array.isArray(req.files)
      ? req.files.filter((f) => f.fieldname.startsWith("files_"))
      : [];

    if (archivos.length === 0) {
      return next();
    }

    req.bibliotecaFiles = {}; // Objeto estructurado por campo/sección

    for (const file of archivos) {
      const campo = file.fieldname; // ej: "files_1", "files_general", etc.

      try {
        const storageName = await uploadToGCS(file);
        const archivoData = {
          storageName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        };

        if (!req.bibliotecaFiles[campo]) {
          req.bibliotecaFiles[campo] = [];
        }
        req.bibliotecaFiles[campo].push(archivoData);
      } catch (err) {
        console.error(
          `Error subiendo archivo biblioteca (${campo}) a GCS:`,
          err,
        );
      }
    }

    next();
  } catch (error) {
    console.error("Error procesando assets de biblioteca:", error);
    next();
  }
};
