// Server-side validation for the job create/edit forms
// (POST /jobs/create and POST /jobs/:id/edit).
//
// This middleware runs BEFORE the controller and is chained in the route:
//   routes/jobRoute.js -> router.post("/create", uploadJobFiles, validateJobCreate, ...);
//
// Behavior:
//   - All rules pass  -> next() is called and the controller runs.
//   - Any rule fails  -> the form that submitted the request is re-rendered
//       (HTTP 422) with:
//       errors    : object mapping field name -> first error message
//                   (e.g. { title: "Job title is required." })
//       formData  : the submitted req.body values, so fields stay filled in
//       categories: re-fetched so the category dropdown still renders
//       job       : (edit only) the job being edited, with its attachments
//
// The Sequelize model constraints (allowNull / ENUM / lengths) in
// models/job.js remain the last line of defense at the database layer.

const { body, validationResult } = require("express-validator");
const { loadCategories, loadEditJob } = require("./jobFormContext");
const { cleanupUploadedFiles } = require("./uploadJobFiles");
const CONSTANTS = require("./jobValidationConstants");

// Values come from the shared constants module (single source of truth
// also used by the client-side validator).
const EMPLOYMENT_TYPES = CONSTANTS.employmentTypes;
const SUBMITTABLE_STATUSES = CONSTANTS.statuses;
const MAX_TEXT_LENGTH = CONSTANTS.maxTextLength;
const TITLE = CONSTANTS.title;
const ORGANIZATION = CONSTANTS.organization;
const CATEGORY_ID = CONSTANTS.categoryId;
const LOCATION = CONSTANTS.location;
const SLUG = CONSTANTS.slug;
const SALARY = CONSTANTS.salary;
const APPLICATION_URL = CONSTANTS.applicationUrl;
const APPLICATION_EMAIL = CONSTANTS.applicationEmail;
const SOURCE_NAME = CONSTANTS.sourceName;
const SOURCE_URL = CONSTANTS.sourceUrl;

const jobValidationRules = [
  // ---------- Basic information ----------

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Job title is required.")
    .isLength({ max: TITLE.max })
    .withMessage(`Job title must be ${TITLE.max} characters or fewer.`)
    .isLength({ min: TITLE.min })
    .withMessage(`Job title must be at least ${TITLE.min} characters long.`),

  body("organization")
    .trim()
    .notEmpty()
    .withMessage("Organization name is required.")
    .isLength({ min: ORGANIZATION.min })
    .withMessage(
      `Organization name must be at least ${ORGANIZATION.min} characters long.`,
    )
    .isLength({ max: ORGANIZATION.max })
    .withMessage(
      `Organization name must be ${ORGANIZATION.max} characters or fewer.`,
    ),

  // Optional in the model (categoryId || null in the controller), but it must
  // be a positive integer whenever it is submitted.
  body("categoryId")
    .optional({ values: "falsy" })
    .isInt({ min: CATEGORY_ID.min })
    .withMessage("Selected category is invalid."),

  body("location")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: LOCATION.max })
    .withMessage(`Location must be ${LOCATION.max} characters or fewer.`),

  body("employmentType")
    .optional({ values: "falsy" })
    .isIn(EMPLOYMENT_TYPES)
    .withMessage("Employment type is invalid."),

  // Optional hint; the controller always generates the final unique slug.
  body("slug")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: SLUG.max })
    .withMessage(`Slug must be ${SLUG.max} characters or fewer.`),

  // ---------- Job details ----------

  body("salary")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: SALARY.max })
    .withMessage(`Salary must be ${SALARY.max} characters or fewer.`),

  body("deadline")
    .optional({ values: "falsy" })
    .isDate({ format: "YYYY-MM-DD", strictMode: true })
    .withMessage("Deadline must be a valid date in YYYY-MM-DD format.")
    .custom(async (value, { req }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const deadline = new Date(value + "T00:00:00");

      // Editing an existing job: an UNCHANGED past deadline is allowed (the
      // job simply expired - rejecting the whole edit would make it
      // impossible to fix images or other content on old jobs). Only a
      // CHANGED deadline must be today or in the future.
      if (req.params && req.params.id) {
        const { Job } = require("../models");

        const job = await Job.findByPk(req.params.id, {
          attributes: ["deadline"],
        });

        if (job && job.deadline) {
          const stored = String(job.deadline).slice(0, 10);
          if (stored === value) {
            return true; // unchanged - allow even if in the past
          }
        }
      }

      if (deadline < today) {
        throw new Error("Deadline must be today or a future date.");
      }

      return true;
    }),

  // ---------- Description ----------

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required.")
    .isLength({ max: MAX_TEXT_LENGTH })
    .withMessage("Description is too long."),

  body("responsibilities")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: MAX_TEXT_LENGTH })
    .withMessage("Responsibilities are too long."),

  body("requirements")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: MAX_TEXT_LENGTH })
    .withMessage("Requirements are too long."),

  body("qualifications")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: MAX_TEXT_LENGTH })
    .withMessage("Qualifications are too long."),

  // ---------- Application information ----------

  body("applicationUrl")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: APPLICATION_URL.max })
    .withMessage(
      `Application URL must be ${APPLICATION_URL.max} characters or fewer.`,
    ),

  body("applicationEmail")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: APPLICATION_EMAIL.max })
    .withMessage(
      `Application email must be ${APPLICATION_EMAIL.max} characters or fewer.`,
    )
    .isEmail()
    .withMessage("Application email must be a valid email address."),

  body("applicationInstructions")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: MAX_TEXT_LENGTH })
    .withMessage("Application instructions are too long."),

  // ---------- Original source ----------

  body("sourceName")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: SOURCE_NAME.max })
    .withMessage(`Source name must be ${SOURCE_NAME.max} characters or fewer.`),

  body("sourceUrl")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: SOURCE_URL.max })
    .withMessage(`Source URL must be ${SOURCE_URL.max} characters or fewer.`)
    .isURL({ require_protocol: true })
    .withMessage(
      "Source URL must be a valid URL (e.g. https://source.com/job).",
    ),

  // ---------- Publishing ----------

  body("status")
    .optional({ values: "falsy" })
    .isIn(SUBMITTABLE_STATUSES)
    .withMessage("Status must be either 'draft' or 'published'."),

];

// ---------- Final gate factory ----------
// Shared by create and edit. Collects all rule failures; if there are any,
// re-renders the view that submitted the request (options.errorView) with
// error messages and the submitted values instead of continuing.
// options.getRenderData(req) reloads the context the view needs.
const makeGate =
  ({ errorView, getRenderData }) =>
  async (req, res, next) => {
    const result = validationResult(req);

    if (result.isEmpty()) {
      return next();
    }

    // Map: field name -> first error message for that field
    const errors = {};
    for (const issue of result.array({ onlyFirstError: true })) {
      const field = issue.path || issue.param;
      if (field && !errors[field]) {
        errors[field] = issue.msg;
      }
    }

    // Multer has already saved any newly picked files to disk by the time
    // validation runs. The form re-render cannot restore the browser's file
    // selection (browsers never repopulate file inputs), so the user will
    // re-pick them on the next submit - delete these now or they would be
    // orphaned on disk with no database row.
    cleanupUploadedFiles(req);

    const context = await getRenderData(req).catch(() => ({
      categories: [],
    }));

    return res.status(422).render(errorView, {
      ...context,
      errors,
      formData: req.body,
    });
  };

// Factory: validation chain for a given form (create or edit).
const makeValidateJob = (options) => [...jobValidationRules, makeGate(options)];

// Create variant: re-renders the create form (fresh category dropdown).
const validateJobCreate = makeValidateJob({
  errorView: "job/createJobs.handlebars",
  getRenderData: async () => ({ categories: await loadCategories() }),
});

// Edit variant: also loads the job being edited so the form action URL and
// the existing attachments still render after a failure.
const validateJobEdit = makeValidateJob({
  errorView: "job/editJobs.handlebars",
  getRenderData: async (req) => ({
    categories: await loadCategories(),
    job: await loadEditJob(req),
  }),
});

module.exports = { validateJobCreate, validateJobEdit, makeValidateJob };
