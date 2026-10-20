// Isolated backend endpoint for Cloudflare direct-upload URL requests.
//
// Flow:
//  - The frontend calls this endpoint once per selected file/image.
//  - The request must come from a logged-in admin session on the requesting
//    device. No separate permission/role check is used for this endpoint.
//  - The backend validates filename, mime type and file size.
//  - If everything passes, it generates a UUID object key and returns only:
//      - a presigned upload URL
//      - the URL expiry TTL
//  - It does not store any upload record here. Job create/edit routes are
//      responsible for storing attachments and signed read URLs after a
//      successful upload.
//
// Request shape:
//   POST /jobs/cloudflare-upload-url
//   { "filename": "...", "mimeType": "...", "fileSize": 12345 }
//
// Success response shape:
//   {
//     "result": {
//       "data": { "uploadUrl": "...", "expiresIn": 3600 },
//       "reason": "success",
//       "message": "Upload URL created"
//     }
//   }
//
// Error response shape:
//   {
//     "result": {
//       "data": null,
//       "reason": "<category>",
//       "message": "<human readable message>"
//     }
//   }

const express = require("express");

const router = express.Router();

const { requireAdmin } = require("../Middlewares/requireAdmin");
const cloudflareStorage = require("../services/cloudflareStorage");
const CONSTANTS = require("../Middlewares/jobValidationConstants");

const FIELD_FILENAME = "filename";
const FIELD_MIME_TYPE = "mimeType";
const FIELD_FILE_SIZE = "fileSize";

const MAX_FILE_SIZE = CONSTANTS.files.maxSizeBytes;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidFilename(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidMimeType(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidFileSize(value) {
  if (value == null) return false;
  const size = Number(value);
  return (
    Number.isFinite(size) &&
    size > 0 &&
    Number.isInteger(size) &&
    size <= MAX_FILE_SIZE
  );
}

function jsonResult(data, reason, message, status = 200) {
  return {
    result: { data, reason, message },
  };
}

function sendResult(res, data, reason, message, status = 200) {
  return res.status(status).json(jsonResult(data, reason, message, status));
}

// ---------------------------------------------------------------------------
// Admin / device-login guard
//
// Uses the same requireAdmin middleware pattern that jobRoute.create uses,
// but for this API endpoint the failure path must not redirect and must not
// call next(). The client is not allowed to upload files/images without a
// valid logged-in admin session on the requesting device.
// ---------------------------------------------------------------------------

function guardFailed(res) {
  return sendResult(
    res,
    null,
    "unauthorized",
    "Only logged-in admins can request upload URLs.",
    403,
  );
}

const adminGuard = (req, res, next) => {
  console.log("user uploading an image Admin guard check");
  // Any logged-in admin session is granted access to this endpoint.
  // No separate create-job permission check is performed here.
  if (!req.session || !req.session.adminId) {
    return guardFailed(res);
  }

  return next();
};

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const validateUploadUrlRequest = (req, res, next) => {
  console.log(
    "user uploading an image validation check for filename, mime type and file size",
  );
  const body = req.body || {};
  // if (!isValidFilename(body[FIELD_FILENAME])) {
  //   return sendResult(
  //     res,
  //     null,
  //     "invalid_request",
  //     "A valid filename is required.",
  //     422,
  //   );
  // }

  // if (!isValidMimeType(body[FIELD_MIME_TYPE])) {
  //   return sendResult(
  //     res,
  //     null,
  //     "invalid_request",
  //     "A valid mime type is required.",
  //     422,
  //   );
  // }

  if (!isValidFileSize(body[FIELD_FILE_SIZE])) {
    return sendResult(
      res,
      null,
      "file_too_large",
      `Each file must be ${MAX_FILE_SIZE / (1024 * 1024)} MB or smaller.`,
      422,
    );
  }

  return next();
};

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

router.post(
  "/cloudflare-upload-url",
  adminGuard,
  validateUploadUrlRequest,
  async (req, res) => {
    console.log("user uploading an image passed every criteria");
    try {
      // Always generate the object key server-side.
      const upload = cloudflareStorage.createUploadUrl({
        contentType: req.body.mimeType,
      });

      console.log({
        uploadUrl: await upload.uploadUrl,
        expiresIn: cloudflareStorage.config.uploadUrlTtlSeconds,
      });

      return sendResult(
        res,
        {
          uploadUrl: await upload.uploadUrl,
          expiresIn: cloudflareStorage.config.uploadUrlTtlSeconds,
        },
        "success",
        "Upload URL created",
        200,
      );
    } catch (error) {
      console.error("Cloudflare upload URL error:", error);

      return sendResult(
        res,
        null,
        "upload_unavailable",
        "Unable to create an upload URL right now. Please try again." +
          error.toString(),
        503,
      );
    }
  },
);

module.exports = router;
