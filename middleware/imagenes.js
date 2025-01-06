import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import bucket from '../config/gcs.js';

// Configuración de Multer para usar almacenamiento en memoria
const upload = multer({
  storage: multer.memoryStorage(),
});

// Función para cargar el archivo a Google Cloud Storage (GCS)
const uploadToGCS = async (file) => {
  const blob = bucket.file(`${uuidv4()}-${file.originalname}`);
  const stream = blob.createWriteStream({
    metadata: { contentType: file.mimetype },
  });

  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('finish', async () => {
      // Generate signed URL for limited access
      const [url] = await blob.getSignedUrl({
        action: 'read',
        expires: Date.now() + 3600 * 1000, // URL valid for 1 hour
      });
      resolve(url);
    });
    stream.end(file.buffer);
  });
};

// Middleware para manejar una sola imagen y cargarla en GCS
export const handleUpload = upload.single('imagen'); // Asegúrate de que el nombre coincida con el campo del formulario

// Middleware para procesar el archivo después de ser cargado
export const processFile = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error('No se proporcionó ningún archivo.');
    }

    const uploadedFileUrl = await uploadToGCS(req.file);
    req.uploadedFile = uploadedFileUrl;  // Guarda la URL del archivo cargado
    next();
  } catch (error) {
    next();
  }
};
