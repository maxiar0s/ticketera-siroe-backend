import { Storage } from "@google-cloud/storage";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";
import { Writable } from "node:stream";

const storageProvider = (process.env.STORAGE_PROVIDER || "gcs").trim().toLowerCase();
const s3InternalEndpoint = process.env.S3_ENDPOINT || "";
const s3PublicEndpoint = process.env.S3_PUBLIC_ENDPOINT || s3InternalEndpoint;

const resolveBucketName = () => {
  if (storageProvider === "s3") {
    return process.env.S3_BUCKET_NAME || process.env.STORAGE_BUCKET_NAME;
  }

  return process.env.GCLOUD_BUCKET_NAME || process.env.STORAGE_BUCKET_NAME;
};

const bucketName = resolveBucketName();

if (!bucketName) {
  throw new Error("No se configuró el bucket de almacenamiento.");
}

const buildS3Client = (endpoint) => {
  const region = process.env.S3_REGION || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Faltan variables S3_ENDPOINT, S3_ACCESS_KEY_ID o S3_SECRET_ACCESS_KEY para almacenamiento S3.",
    );
  }

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: `${process.env.S3_FORCE_PATH_STYLE ?? "true"}` === "true",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

const buildGcsBucket = () => {
  const storage = new Storage({
    projectId: process.env.GCLOUD_PROJECT_ID,
    keyFilename: process.env.GCLOUD_KEY_FILE,
  });

  return storage.bucket(bucketName);
};

const s3Client = storageProvider === "s3" ? buildS3Client(s3InternalEndpoint) : null;
const s3PublicClient =
  storageProvider === "s3" ? buildS3Client(s3PublicEndpoint) : null;
const gcsBucket = storageProvider === "gcs" ? buildGcsBucket() : null;

const normalizeMetadata = (metadata = {}) => {
  const normalized = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) {
      continue;
    }
    normalized[key] = `${value}`;
  }
  return normalized;
};

const getExpiresInSeconds = (expires) => {
  if (typeof expires === "number" && Number.isFinite(expires) && expires > 0 && expires <= 60 * 60 * 24 * 7) {
    return Math.floor(expires);
  }

  if (!expires) {
    return 60 * 60;
  }

  const diffMs = Number(expires) - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 60;
  }

  return Math.max(1, Math.floor(diffMs / 1000));
};

const getSignedUrlExpires = () => {
  if (storageProvider === "s3") {
    return 60 * 60 * 24 * 7;
  }

  return Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
};

const s3LegacyPrefixes = ["data/"];

const s3ObjectExists = async (key) => {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
};

const resolveS3Key = async (fileName) => {
  if (await s3ObjectExists(fileName)) {
    return fileName;
  }

  for (const prefix of s3LegacyPrefixes) {
    const candidate = `${prefix}${fileName}`;
    if (await s3ObjectExists(candidate)) {
      return candidate;
    }
  }

  return fileName;
};

const createS3File = (fileName) => ({
  name: fileName,
  createWriteStream(options = {}) {
    const chunks = [];

    return new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        callback();
      },
      final(callback) {
        const metadata = options?.metadata ?? {};
        s3Client
          .send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: fileName,
              Body: Buffer.concat(chunks),
              ContentType: metadata.contentType,
              Metadata: normalizeMetadata(metadata),
            }),
          )
          .then(() => callback())
          .catch((error) => callback(error));
      },
    });
  },
  async save(content, options = {}) {
    const metadata = options?.metadata ?? {};
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: content,
        ContentType: metadata.contentType,
        Metadata: normalizeMetadata(metadata),
      }),
    );
  },
  async delete() {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      }),
    );
  },
  async getSignedUrl(options = {}) {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
    });

    const url = await getS3SignedUrl(s3PublicClient, command, {
      expiresIn: getExpiresInSeconds(options.expires),
    });

    return [url];
  },
});

const bucket =
  storageProvider === "s3"
    ? {
        name: bucketName,
        file(fileName) {
          return createS3File(fileName);
        },
      }
    : gcsBucket;

/**
 * Genera una URL firmada para acceder a un archivo en GCS.
 * @param {string} fileName - Nombre del archivo en el bucket
 * @returns {Promise<string>} URL firmada con expiración de 10 años
 */
export const generateSignedUrl = async (fileName) => {
  try {
    const resolvedFileName =
      storageProvider === "s3" ? await resolveS3Key(fileName) : fileName;
    const file = bucket.file(resolvedFileName);
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: getSignedUrlExpires(),
    });
    return url;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw error;
  }
};

export default bucket;
