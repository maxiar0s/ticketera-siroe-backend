import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import bucket from '../config/gcs.js';

const upload = multer({
  storage: multer.memoryStorage(),
});

const uploadToGCS = async (file) => {
  const typeFile = file.originalname.split('.');
  const ext = typeFile.length > 1 ? typeFile[typeFile.length - 1] : '';
  const blob = bucket.file(`${uuidv4()}.${ext}`);
  const stream = blob.createWriteStream({
    metadata: { contentType: file.mimetype },
  });

  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('finish', async () => {
      resolve(blob.name);
    });
    stream.end(file.buffer);
  });
};

// single image compatibility
export const handleUpload = upload.single('imagen');
export const processFile = async (req, res, next) => {
  try {
    if (!req.file) {
      console.log('No se proporcionó ningún archivo, continuando...');
      return next();
    }

    console.log('Archivo recibido en processFile:', req.file.originalname);

    const fileName = await uploadToGCS(req.file);
    console.log('Nombre de archivo subido a GCS:', fileName);
    req.uploadedFile = fileName;
    next();
  } catch (error) {
    console.log(error);
    next();
  }
};

// multiple files support for bitacoras
export const handleFiles = upload.fields([
  { name: 'files', maxCount: 20 },
  { name: 'evidenceFiles', maxCount: 20 },
]);
export const processFiles = async (req, res, next) => {
  try {
    if (!req.files || (Object.keys(req.files).length === 0)) {
      console.log('No se proporcionaron archivos (files/evidenceFiles), continuando...');
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

    const adjuntosIngreso = await procesarCampo('files');
    const adjuntosEvidencia = await procesarCampo('evidenceFiles');

    if (adjuntosIngreso.length) {
      console.log('Archivos de ingreso subidos a GCS:', adjuntosIngreso);
      req.uploadedFiles = adjuntosIngreso;
    }
    if (adjuntosEvidencia.length) {
      console.log('Archivos de evidencia subidos a GCS:', adjuntosEvidencia);
      req.uploadedEvidenceFiles = adjuntosEvidencia;
    }

    next();
  } catch (error) {
    console.log(error);
    next();
  }
};
