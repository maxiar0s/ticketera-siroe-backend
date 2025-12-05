import { Storage } from "@google-cloud/storage";

const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_KEY_FILE,
});

const bucket = storage.bucket(process.env.GCLOUD_BUCKET_NAME);

/**
 * Genera una URL firmada para acceder a un archivo en GCS.
 * @param {string} fileName - Nombre del archivo en el bucket
 * @returns {Promise<string>} URL firmada con expiración de 10 años
 */
export const generateSignedUrl = async (fileName) => {
  try {
    const file = bucket.file(fileName);
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10, // 10 años
    });
    return url;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw error;
  }
};

export default bucket;
