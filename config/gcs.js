import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: './siroe-app-b05788f46aa7.json'
});

const bucket = storage.bucket(process.env.GCLOUD_BUCKET_NAME);

export default bucket;
