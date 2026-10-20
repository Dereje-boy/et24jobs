// Cloudflare object storage config
// Single read-only config layer for the Cloudflare direct-upload flow.
// This module does not generate URLs and does not upload files.
// It only normalizes env so the rest of the app has one source of truth.
//
// Decisions baked into this config:
//  - uploads use presigned PUT URLs
//  - reads use signed URLs from the same credentials
//  - object keys are UUID-based, generated later in the storage service
//  - MIME is informational only; the only hard limit is file size
//  - attachment limits come from .env and are shared with the job validation layer
//
// Env mapping:
//  - Uses existing CLOUDFLARE_* host/bucket/prefix/credential/ttl vars already
//    present in your .env.
//  - Does NOT require a new endpoint-only var by default; if you prefer a clean
//    endpoint-only env later, set CLOUDFLARE_STORAGE_ENDPOINT_HOST and leave
//    CLOUDFLARE_STORAGE_HOST out or empty.

function requireEnv(name) {
  const value = process.env[name];
  if (!value || String(value).trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(value).trim();
}

function optionalEnv(name, fallback = "") {
  const value = process.env[name];
  if (!value || String(value).trim() === "") {
    return fallback;
  }
  return String(value).trim();
}

function parseBool(value, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0" || normalized === "") {
    return false;
  }
  return fallback;
}

function parsePositiveInt(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim();
  if (normalized === "") return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return fallback;
  }
  return parsed;
}

// ---- Endpoint parsing ----
// Accepts either an endpoint-only host or a host with an extra path segment.
// Example endpoint-only: https://c07d7b079fbdf488693d21a1bb631090.eu.r2.cloudflarestorage.com
// Example with path:     https://c07d7b079fbdf488693d21a1bb631090.eu.r2.cloudflarestorage.com/et24jobs
//
// The bucket name is taken from CLOUDFLARE_STORAGE_BUCKET, not parsed out of
// the host, so the config can stay consistent with the existing env file.
function parseEndpointOrigin(endpointValue) {
  const trimmed = (endpointValue || "").trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (/^\s*https?:\/\//i.test(normalized) === false) {
    normalized = `https://${normalized}`;
  }

  try {
    const url = new URL(normalized);
    return url.origin;
  } catch (error) {
    return null;
  }
}

// ---- Bucket + prefix normalization ----
// Prefix is treated as a path prefix for object keys, not as part of the bucket.
function normalizePrefix(prefixValue) {
  const trimmed = (prefixValue || "").trim();
  if (!trimmed) return "";
  if (trimmed === "/") return "";
  let normalized = trimmed.replace(/\/+$/, "");
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

// ---- Config from existing env ----
const CLOUDFLARE_ENABLED = parseBool(
  process.env.CLOUDFLARE_UPLOAD_ENABLED,
  false,
);
const CLOUDFLARE_UPLOAD_VIA_PRESIGNED = parseBool(
  process.env.CLOUDFLARE_UPLOAD_VIA_PRESIGNED,
  true,
);
const CLOUDFLARE_READ_VIA_SIGNED_URL = parseBool(
  process.env.CLOUDFLARE_READ_VIA_SIGNED_URL,
  true,
);

// Endpoint host is preferred when set cleanly. If only the old host var is set,
// we extract its origin as a fallback so this config layer still works with the
// current .env without changing it.
const CLOUDFLARE_ENDPOINT_HOST = parseEndpointOrigin(
  optionalEnv("CLOUDFLARE_STORAGE_ENDPOINT_HOST"),
);
const CLOUDFLARE_STORAGE_HOST = optionalEnv("CLOUDFLARE_STORAGE_HOST");
const CLOUDFLARE_HOST_ORIGIN =
  CLOUDFLARE_ENDPOINT_HOST ||
  parseEndpointOrigin(CLOUDFLARE_STORAGE_HOST) ||
  null;

const CLOUDFLARE_BUCKET = requireEnv("CLOUDFLARE_STORAGE_BUCKET");
const CLOUDFLARE_PREFIX = normalizePrefix(
  process.env.CLOUDFLARE_STORAGE_PREFIX,
);

const CLOUDFLARE_ACCESS_KEY_ID = optionalEnv("CLOUDFLARE_ACCESS_KEY_ID");
const CLOUDFLARE_SECRET_ACCESS_KEY = optionalEnv(
  "CLOUDFLARE_SECRET_ACCESS_KEY",
);

const CLOUDFLARE_UPLOAD_URL_TTL_SECONDS = parsePositiveInt(
  process.env.CLOUDFLARE_UPLOAD_URL_TTL_SECONDS,
  3600,
);

const CLOUDFLARE_PUBLIC_OBJECT_BASE_URL = optionalEnv(
  "CLOUDFLARE_PUBLIC_OBJECT_BASE_URL",
);

const CLOUDFLARE_MAX_FILES = process.env.JOB_ATTACHMENT_MAX_FILES;
const CLOUDFLARE_MAX_SIZE_BYTES = process.env.JOB_ATTACHMENT_MAX_SIZE_BYTES;

const parsedMaxFiles = parsePositiveInt(CLOUDFLARE_MAX_FILES, 0);
const parsedMaxSizeBytes = parsePositiveInt(CLOUDFLARE_MAX_SIZE_BYTES, 0);
// ---- Public shape ----
const config = {
  enabled: CLOUDFLARE_ENABLED,
  uploadViaPresigned: CLOUDFLARE_UPLOAD_VIA_PRESIGNED,
  readViaSignedUrl: CLOUDFLARE_READ_VIA_SIGNED_URL,

  // Host interface for the storage service and upload URL builder.
  // endpointHost is the clean origin if you set CLOUDFLARE_STORAGE_ENDPOINT_HOST.
  // hostOrigin is the origin extracted from whatever host var is currently set.
  // storageHost is the raw value from CLOUDFLARE_STORAGE_HOST, if any.
  endpointHost: CLOUDFLARE_ENDPOINT_HOST,
  hostOrigin: CLOUDFLARE_HOST_ORIGIN,
  storageHost: CLOUDFLARE_STORAGE_HOST,

  bucket: CLOUDFLARE_BUCKET,
  prefix: CLOUDFLARE_PREFIX,

  accessKeyId: CLOUDFLARE_ACCESS_KEY_ID,
  secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY,

  uploadUrlTtlSeconds: CLOUDFLARE_UPLOAD_URL_TTL_SECONDS,

  publicObjectBaseUrl: CLOUDFLARE_PUBLIC_OBJECT_BASE_URL,

  maxFiles: parsedMaxFiles,
  maxSizeBytes: parsedMaxSizeBytes,
};

// ---- Guardrails ----
if (config.enabled) {
  if (!config.hostOrigin) {
    throw new Error(
      "CLOUDFLARE upload is enabled but no usable storage host is configured. " +
        "Set CLOUDFLARE_STORAGE_ENDPOINT_HOST, or set CLOUDFLARE_STORAGE_HOST " +
        "to a valid https://... endpoint.",
    );
  }

  if (config.uploadViaPresigned) {
    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error(
        "CLOUDFLARE upload via presigned URL is enabled, but credentials are " +
          "missing. Set CLOUDFLARE_ACCESS_KEY_ID and CLOUDFLARE_SECRET_ACCESS_KEY.",
      );
    }
  }

  if (!config.bucket) {
    throw new Error(
      "CLOUDFLARE upload is enabled but CLOUDFLARE_STORAGE_BUCKET is missing.",
    );
  }
  if (
    !Number.isFinite(config.maxFiles) ||
    config.maxFiles <= 0 ||
    !Number.isFinite(config.maxSizeBytes) ||
    config.maxSizeBytes <= 0
  ) {
    throw new Error(
      "CLOUDFLARE upload is enabled but job attachment limits are invalid. " +
        "Check JOB_ATTACHMENT_MAX_FILES and JOB_ATTACHMENT_MAX_SIZE_BYTES.",
    );
  }
}

module.exports = config;
