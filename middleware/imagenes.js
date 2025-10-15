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
export const handleFiles = upload.array('files');
export const processFiles = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      console.log('No se proporcionaron archivos (files), continuando...');
      return next();
    }

    const uploadedNames = [];
    for (const file of req.files) {
      try {
        const name = await uploadToGCS(file);
        uploadedNames.push(name);
      } catch (err) {
        console.error('Error subiendo archivo a GCS:', err);
      }
    }

    console.log('Archivos subidos a GCS:', uploadedNames);
    req.uploadedFiles = uploadedNames;
    next();
  } catch (error) {
    console.log(error);
    next();
  }
};
