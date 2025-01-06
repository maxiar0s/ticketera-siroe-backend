import { Storage } from '@google-cloud/storage';

const credentials = JSON.parse(
  Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8')
);

const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  credentials: credentials
});

const bucket = storage.bucket(process.env.GCLOUD_BUCKET_NAME);

export default bucket;
