// A local S3 server for exercising STORAGE_DRIVER=s3 (used with tests/14-s3-storage.cjs). Run it in the background:
//   node tests/s3-server.cjs
// then start the app with STORAGE_DRIVER=s3 S3_ENDPOINT=http://127.0.0.1:4570 S3_BUCKET=intelliq-app
//   S3_ACCESS_KEY_ID=S3RVER S3_SECRET_ACCESS_KEY=S3RVER S3_REGION=us-east-1
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const S3rver = require("s3rver");

const dir = path.join(os.tmpdir(), "intelliq-s3-app");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
new S3rver({ port: 4570, address: "127.0.0.1", silent: true, directory: dir, configureBuckets: [{ name: "intelliq-app", configs: [] }] })
  .run()
  .then(() => console.log("S3 server ready on http://127.0.0.1:4570, bucket intelliq-app"));
