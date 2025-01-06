import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import bucket from '../config/gcs.js';

const upload = multer({
  storage: multer.memoryStorage(),
});

const uploadToGCS = async (file) => {
  const typeFile = file.originalname.split('.');
  const blob = bucket.file(`${uuidv4()}.${typeFile[1]}`);
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

export const handleUpload = upload.single('imagen'); 

export const processFile = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error('No se proporcionó ningún archivo.');
    }

    const fileName = await uploadToGCS(req.file);
    req.uploadedFile = fileName;
    next();
  } catch (error) {
    console.log(error);
    next();
  }
};
