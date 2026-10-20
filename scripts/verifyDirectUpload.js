// TEMPORARY verification for Cloudflare direct upload support.
//   node scripts/verifyDirectUpload.js
//
// 1. Fetchs /jobs/cloudflare-config and asserts it is reachable and indicates
//    direct uploads are enabled + presigned.
// 2. Requests a pre-signed upload URL from /jobs/cloudflare-upload-url.
// 3. PUTs a small body directly to the returned Cloudflare URL.
// 4. Reports the object key and URL status.
//
// This script does NOT create a real job and does NOT touch MySQL. It only
// exercises the backend upload-url endpoints and one direct PUT to Cloudflare.
//
// Delete after use.

require("dotenv").config();

const BASE = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

const log = (message) => console.log(message);
const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

(async () => {
  log("Base URL:", BASE);

  let config;
  try {
    const configResponse = await fetch(`${BASE}/jobs/cloudflare-config`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!configResponse.ok) {
      fail(`config endpoint returned ${configResponse.status}`);
      return;
    }

    config = await configResponse.json();
    log("Config:", JSON.stringify(config, null, 2));
  } catch (error) {
    fail(`config endpoint unreachable: ${error && error.message}`);
    return;
  }

  if (!config || !config.enabled || !config.viaPresigned) {
    fail("Direct uploads are not enabled or not signed in this server config.");
    return;
  }

  if (!config.storageScheme || !config.storageHost || !config.storageBucket || !config.storagePrefix) {
    fail("Cloudflare config is missing storage details. Check env.");
    return;
  }

  log("Direct upload config looks usable.");

  const testObjectKey = `verify-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let uploadPayload;
  try {
    const uploadResponse = await fetch(`${BASE}/jobs/cloudflare-upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectKey: testObjectKey }),
    });

    if (!uploadResponse.ok) {
      fail(`upload-url endpoint returned ${uploadResponse.status}`);
      return;
    }

    uploadPayload = await uploadResponse.json();
    log("Upload payload:", JSON.stringify(uploadPayload, null, 2));
  } catch (error) {
    fail(`upload-url endpoint unreachable: ${error && error.message}`);
    return;
  }

  if (!uploadPayload || !uploadPayload.url || !uploadPayload.objectKey) {
    fail("Upload URL payload missing url or objectKey.");
    return;
  }

  if (uploadPayload.objectKey !== testObjectKey) {
    fail("Server returned a different objectKey than requested.");
    return;
  }

  let putOk = false;
  try {
    const putResponse = await fetch(uploadPayload.url, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: Buffer.from("direct-upload verification payload"),
    });

    log("PUT status:", putResponse.status, putResponse.statusText);

    if (putResponse.ok) {
      putOk = true;
      log("Direct PUT to Cloudflare succeeded.");
    } else {
      fail(`Direct PUT to Cloudflare failed: ${putResponse.status} ${putResponse.statusText}`);
    }
  } catch (error) {
    fail(`Direct PUT to Cloudflare unreachable: ${error && error.message}`);
  }

  if (!putOk) {
    return;
  }

  log("Verification complete. Test object key:", testObjectKey);
  log("Note: the test object still exists in Cloudflare. Delete it if you want.");
})().catch((error) => {
  console.error("Unexpected error:", error);
  fail("Unexpected script failure.");
});
