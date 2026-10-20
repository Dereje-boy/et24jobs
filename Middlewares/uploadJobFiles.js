// Multer configuration for the job create/edit forms.
//
// Accepts up to MAX_FILES files under the form field name "attachments" and
// stores them in public/uploads/jobs/ with generated names:
//
//   <timestamp>-<random hex>.<sanitized original extension>
//
// Generated names (not user-supplied ones) prevent path traversal, name
// collisions and overwrites. Files saved here are publicly served by
// express.static("public") under /uploads/jobs/<storedName>.
//
// Any file type is allowed by design, but each file is capped at
// MAX_FILE_SIZE bytes. On multer errors the form that submitted the request
// is re-rendered (HTTP 422) with the message under errors.attachments,
// mirroring the behavior of Middlewares/validateJob.js.
//
// Two variants are exported:
//   uploadJobFiles      - for POST /jobs/create (re-renders the create form)
//   makeUploadJobFiles  - factory used by routes/jobRoute.js to build the
//                         edit variant, which re-renders the edit form with
//                         the job being edited

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const { loadCategories, loadEditJob } = require("./jobFormContext");
const CONSTANTS = require("./jobValidationConstants");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "jobs");

const FIELD_NAME = "attachments";
const MAX_FILES = CONSTANTS.files.max;
const MAX_FILE_SIZE = CONSTANTS.files.maxSizeBytes;

// Ensure the upload directory exists before the first request touches it.
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (error) {
  console.error("Unable to create upload directory:", error);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),

  filename: (_req, file, cb) => {
    // Keep only the extension, sanitized: strip path separators/control
    // chars, cap its length so the whole stored name fits the DB column.
    const original = path.basename(file.originalname || "");
    const ext = path
      .extname(original)
      .replace(/[^a-zA-Z0-9.]/g, "")
      .slice(0, 10);

    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE,
  },
  // No fileFilter: any file type is allowed by design.
});

// Deletes any files multer already saved to disk. Used when validation
// fails or a controller errors out, so no orphan files remain.
const cleanupUploadedFiles = (req) => {
  if (!req.files || req.files.length === 0) return;

  for (const file of req.files) {
    fs.promises
      .unlink(file.path)
      .catch((error) =>
        console.error("Unable to remove uploaded file:", error),
      );
  }

  req.files = [];
};

// Friendly messages for multer's limit errors.
const multerErrorMessage = (error) => {
  if (error.code === "LIMIT_FILE_COUNT") {
    return `You can attach up to ${MAX_FILES} files.`;
  }
  if (error.code === "LIMIT_FILE_SIZE") {
    return `Each file must be ${MAX_FILE_SIZE / (1024 * 1024)} MB or smaller.`;
  }
  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return "Unexpected file field. Please use the attachments dropzone.";
  }
  return "Unable to upload the attached files. Please try again.";
};

// Re-renders the form that submitted the request after a multer error.
// options.errorView   - template to render ("job/createJobs" | "job/editJobs")
// options.getRenderData(req) - resolves the extra context (categories, and
//                       for the edit form the job being edited)
const renderFormWithError = async (req, res, error, options) => {
  const { errorView, getRenderData } = options;

  const context = await getRenderData(req).catch(() => ({
    categories: [],
  }));

  return res.status(422).render(errorView, {
    ...context,
    errors: { attachments: multerErrorMessage(error) },
    formData: req.body,
  });
};

// Factory: builds a multer middleware whose failures re-render the given
// view. Both variants must be mounted BEFORE the validation middleware so
// req.body is populated from the multipart request.
const makeUploadJobFiles = (options) => (req, res, next) => {
  upload.array(FIELD_NAME, MAX_FILES)(req, res, (error) => {
    if (!error) {
      return next();
    }

    cleanupUploadedFiles(req);

    renderFormWithError(req, res, error, options).catch((renderError) => {
      console.error("Unable to re-render form after upload error:", renderError);
      res.status(500).send("Unable to upload the attached files.");
    });
  });
};

// Create variant: re-renders the create form (fresh category dropdown).
const uploadJobFiles = makeUploadJobFiles({
  errorView: "job/createJobs.handlebars",
  getRenderData: async () => ({ categories: await loadCategories() }),
});

// Edit variant: also loads the job being edited so the form action URL and
// the existing attachments still render after a failure.
const editUploadJobFiles = makeUploadJobFiles({
  errorView: "job/editJobs.handlebars",
  getRenderData: async (req) => ({
    categories: await loadCategories(),
    job: await loadEditJob(req),
  }),
});

module.exports = {
  uploadJobFiles,
  makeUploadJobFiles,
  editUploadJobFiles,
  cleanupUploadedFiles,
  UPLOAD_DIR,
};
