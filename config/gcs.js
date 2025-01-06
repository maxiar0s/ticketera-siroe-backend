import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_KEY_FILE
});

const bucket = storage.bucket(process.env.GCLOUD_BUCKET_NAME);

export default bucket;
