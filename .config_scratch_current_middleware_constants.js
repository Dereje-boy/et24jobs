// Single source of truth for job form validation limits and enums.
//
// Used in two places:
//   1. Server-side: Middlewares/validateJob.js and Middlewares/uploadJobFiles.js
//   2. Client-side: injected into views as window.JOB_VALIDATION (see the
//      JOB_VALIDATION middleware in app.js) and consumed by
//      public/js/jobs/validation.js + the dropzone scripts
//
// Keep the client messages in public/js/jobs/validation.js in sync with the
// messages in Middlewares/validateJob.js - the criteria themselves live here.

module.exports = {
  // Mirrors the ENUM in models/job.js
  employmentTypes: [
    "full-time",
    "part-time",
    "contract",
    "temporary",
    "internship",
    "volunteer",
  ],

  // Only the statuses the form can submit; the controller defaults to
  // "published" for anything else.
  statuses: ["draft", "published"],

  // Matches the TEXT column size (65535 bytes) with a safe margin for
  // multi-byte characters.
  maxTextLength: 60000,

  title: { min: 5, max: 255 },
  organization: { min: 3, max: 255 },
  categoryId: { min: 1 },
  location: { max: 150 },
  slug: { max: 300 },
  salary: { max: 150 },
  applicationUrl: { max: 500 },
  applicationEmail: { max: 255 },
  sourceName: { max: 255 },
  sourceUrl: { max: 500 },

  // Attachment limits (mirrors multer config in Middlewares/uploadJobFiles.js)
  files: {
    max: 5,
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB per file
  },

  // Mirrors the ENUM in models/jobAttachment.js - lifecycle state of an
  // existing attachment, chosen per image in the job edit form.
  attachmentStatuses: ["published", "draft"],
};
