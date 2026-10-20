// Cloudflare object storage service
//
// Responsibilities:
//  - generate a UUID v4 object key under the configured prefix
//  - create a presigned PUT URL for direct browser upload
//  - create a signed GET URL for reading back the object later
//
// Design notes:
//  - This service does not receive file bytes.
//  - Uploads and reads share the same credentials via the config layer.
//  - The read path is signed URLs by default, matching the current plan.
//  - The prefix is treated as a key path prefix, not as a separate bucket.

const config = require('../config/cloudflareStorageConfig');
const { v4: uuidv4 } = require('uuid');

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;

  const endpoint = config.endpointHost || config.hostOrigin;
  if (!endpoint) {
    throw new Error(
      'Cloudflare storage service: no usable endpoint configured. ' +
        'Set CLOUDFLARE_STORAGE_ENDPOINT_HOST or CLOUDFLARE_STORAGE_HOST.',
    );
  }

  const clientConfig = {
    region: 'auto',
    endpoint,
    forcePathStyle: true,
  };

  if (config.accessKeyId && config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
  }

  s3Client = new S3Client(clientConfig);
  return s3Client;
}

function buildObjectKey(objectKey) {
  const trimmed = (objectKey || '').trim();
  if (!trimmed) {
    throw new Error('Cloudflare storage service: objectKey must not be empty.');
  }

  const prefix = config.prefix;
  if (prefix) {
    return `${prefix}/${trimmed}`;
  }
  return trimmed;
}

function getInputParams(objectKey, extra = {}) {
  return {
    Bucket: config.bucket,
    Key: buildObjectKey(objectKey),
    ...extra,
  };
}

/**
 * Create a presigned PUT URL for direct upload.
 *
 * @param {object} [options]
 * @param {string} [options.contentType] - optional Content-Type to sign
 * @param {string} [options.objectKey] - optional explicit key; by default a
 *   random UUID v4 is generated
 * @returns {{ uploadUrl, objectKey, bucket, normalizedKey }}
 */
function createUploadUrl(options = {}) {
  if (!config.enabled) {
    throw new Error('Cloudflare uploads are not enabled in config.');
  }

  if (!config.uploadViaPresigned) {
    throw new Error(
      'Cloudflare presigned uploads are not enabled. ' +
        'Set CLOUDFLARE_UPLOAD_VIA_PRESIGNED=true in config.',
    );
  }

  const objectKey =
    options.objectKey && options.objectKey.trim()
      ? options.objectKey.trim()
      : uuidv4();

  const normalizedKey = buildObjectKey(objectKey);

  const input = getInputParams(objectKey, {});

  if (options.contentType && options.contentType.trim()) {
    input.ContentType = options.contentType.trim();
  }

  const command = new PutObjectCommand(input);
  const signedUrl = getSignedUrl(getS3Client(), command, {
    expiresIn: config.uploadUrlTtlSeconds,
  });

  return {
    uploadUrl: signedUrl,
    objectKey,
    bucket: config.bucket,
    normalizedKey,
  };
}

/**
 * Create a signed GET URL for reading the object.
 *
 * @param {object} options
 * @param {string} options.objectKey - the stored object key
 * @param {number} [options.expiresSeconds] - TTL override; defaults to config TTL
 * @returns {{ readUrl, objectKey, bucket, normalizedKey }}
 */
function createReadUrl({ objectKey, expiresSeconds } = {}) {
  if (!objectKey || !String(objectKey).trim()) {
    throw new Error(
      'Cloudflare storage service: objectKey is required for a read URL.',
    );
  }

  const normalizedKey = buildObjectKey(objectKey);

  const input = getInputParams(objectKey, {});

  const ttl =
    expiresSeconds && Number.isFinite(expiresSeconds) && expiresSeconds > 0
      ? expiresSeconds
      : config.uploadUrlTtlSeconds;

  const command = new GetObjectCommand(input);
  const signedUrl = getSignedUrl(getS3Client(), command, {
    expiresIn: ttl,
  });

  return {
    readUrl: signedUrl,
    objectKey,
    bucket: config.bucket,
    normalizedKey,
  };
}

/**
 * Object key validation used by other layers when they receive a stored key.
 * It only checks that the key looks like the shape this service produces:
 *   <optional prefix>/<uuid v4>
 */
function looksLikeInternalObjectKey(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (config.prefix) {
    const prefixSegment = `${config.prefix}/`;
    if (!trimmed.startsWith(prefixSegment)) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      trimmed.slice(prefixSegment.length),
    );
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    trimmed,
  );
}

module.exports = {
  config,

  createUploadUrl,
  createReadUrl,

  buildObjectKey,
  looksLikeInternalObjectKey,

  // Expose a small readiness check for health/startup use.
  isEnabled: () => Boolean(config.enabled),
};
