const path = require("path");
const fs = require("fs");
const { db, Job, Category, JobAttachment } = require("../models");
const { Op, UniqueConstraintError } = require("sequelize");
const {
  cleanupUploadedFiles,
  UPLOAD_DIR,
} = require("../Middlewares/uploadJobFiles");
const {
  loadCategories,
  loadEditJob,
} = require("../Middlewares/jobFormContext");
const { notifyJobPublished } = require("../services/telegram");

// Generates a URL-safe slug: "Junior Dev @ ET24!" -> "junior-dev-et24"
const generateSlug = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

exports.index = async (req, res) => {
  try {
    const jobs = await Job.findAll({
      where: {
        status: "published",
      },

      order: [["created_at", "DESC"]],
    });
    // Find attachments for all listed jobs in one query, then group them
    // by jobId for rendering. Drafts stay hidden from the public listing;
    // the edit form loads all states.
    const attachments = await JobAttachment.findAll({
      where: {
        jobId: {
          [Op.in]: jobs.map((job) => job.id),
        },
        status: "published",
      },
      order: [["id", "ASC"]],
    });

    const attachmentsByJob = new Map();
    for (const attachment of attachments) {
      const list = attachmentsByJob.get(attachment.jobId) || [];
      list.push(attachment.toJSON());
      attachmentsByJob.set(attachment.jobId, list);
    }

    res.render("job/index", {
      jobs: jobs.map((job) => ({
        ...job.toJSON(),
        attachments: attachmentsByJob.get(job.id) || [],
      })),
    });
  } catch (error) {
    console.error(error);

    res.status(500).send("Unable to load jobs");
  }
};

exports.detail = async (req, res) => {
  try {
    const adminLoggedIn = Boolean(res.locals && res.locals.adminLoggedIn);

    // Find the requested job
    const job = adminLoggedIn
      ? await Job.findOne({
          where: {
            slug: req.params.slug,
          },
        })
      : await Job.findOne({
          where: {
            slug: req.params.slug,
            status: "published",
          },
        });
    // Job doesn't exist
    if (!job) {
      return res.redirect("/jobs");
    }

    // Find related jobs
    const relatedJobs = await Job.findAll({
      where: {
        id: {
          [Op.ne]: job.id,
        },

        // categoryId: job.categoryId,

        status: "published",
      },

      order: [["created_at", "DESC"]],

      limit: 6,
    });

    // Find attachments for this job (rendered as gallery/download links).
    // Public visitors see only published attachments; a logged-in admin
    // also sees drafts, flagged isDraft so the view can label them. (The
    // edit form loads all states too, so drafts can be re-published.)
    const attachmentRows = await JobAttachment.findAll({
      where: { jobId: job.id },
      order: [["id", "ASC"]],
    });

    const visibleRows = adminLoggedIn
      ? attachmentRows
      : attachmentRows.filter((row) => row.status === "published");

    // Split into images (gallery) and other files (download list)
    const attachments = visibleRows.map((row) => {
      const data = row.toJSON();
      data.isImage =
        typeof data.mimeType === "string" && data.mimeType.startsWith("image/");
      data.isDraft = data.status === "draft";
      return data;
    });

    // Render detail page
    res.render("job/job_detail", {
      job: job.toJSON(),
      attachments,
      attachmentImages: attachments.filter((a) => a.isImage),
      attachmentFiles: attachments.filter((a) => !a.isImage),
      relatedJobs: relatedJobs
        .slice(0, 5)
        .map((relatedJob) => relatedJob.toJSON()),
    });
  } catch (error) {
    console.error(error);

    res.status(500).send("Something went wrong.");
  }
};

exports.post = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { status: "active" },
      order: [["name", "ASC"]],
    });

    // console.log(categories.map((category) => category.toJSON()));

    res.render("job/createJobs.handlebars", {
      categories: categories.map((category) => category.toJSON()),
    });
  } catch (error) {
    console.error(error);

    // Render the form anyway; the category dropdown will just be empty.
    res.render("job/createJobs.handlebars");
  }
};

exports.create = async (req, res) => {
  try {
    const {
      title,
      description,
      organization,
      categoryId,
      employmentType,
      location,
      salary,
      slug,
      deadline,
      responsibilities,
      requirements,
      qualifications,
      applicationUrl,
      applicationEmail,
      applicationInstructions,
      sourceName,
      sourceUrl,
      status,
    } = req.body;

    console.log(req.body);

    const transaction = await db.transaction();

    // Wrap job + attachment rows in a transaction so a failure creating
    // either rolls both back (uploaded files are cleaned up afterwards).
    // Slug fallback: the form's JS normally fills it, but when submitting
    // without JS (or an empty slug) generate one from the title so the
    // NOT NULL constraint never fails; uniqueness is still enforced by the
    // DB (duplicate -> UniqueConstraintError -> form re-render).
    const finalSlug =
      slug && slug.trim()
        ? generateSlug(slug)
        : generateSlug(`${title} ${Date.now()}`);

    const createdJob = await Job.create(
      {
        title,
        description,
        companyName: organization,
        categoryId: categoryId,
        employmentType: employmentType,
        location: location || "Ethiopia",
        salary,
        slug: finalSlug,
        deadline: deadline || null,
        responsibilities,
        requirements,
        qualifications,
        applicationUrl,
        applicationEmail,
        applicationInstructions,
        sourceName,
        sourceUrl,
        status,
      },
      { transaction: transaction },
    );

    // Persist attachment metadata (files are already on disk via multer).
    if (req.files && req.files.length > 0) {
      await JobAttachment.bulkCreate(
        req.files.map((file) => ({
          jobId: createdJob.id,
          storedName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          status: "published",
        })),
        { transaction: transaction },
      );
    }

    await transaction.commit();

    // Announce a directly-published job on the Telegram channel.
    // Fire-and-forget: this redirect target renders no flash, so a failure
    // is logged only - and the admin never waits on Telegram.
    if (createdJob.status === "published") {
      notifyJobPublished(createdJob).catch(() => {});
    }


    res.redirect("/jobs");
  } catch (error) {
    console.error(error);

    await transaction.rollback().catch(() => {});

    // Remove any files that were saved before the failure so no orphans
    // are left on disk without a database row.
    cleanupUploadedFiles(req);

    res.status(500).send("Unable to create job");
  }
};

// ---------------------------------------------------------------------------
// Edit & delete
// ---------------------------------------------------------------------------

// Flags each attachment with isImage so views can split gallery vs downloads
// (same convention as jobController.detail).
const withImageFlag = (attachment) => ({
  ...attachment,
  isImage:
    typeof attachment.mimeType === "string" &&
    attachment.mimeType.startsWith("image/"),
});

// GET /jobs/:id/edit - renders the prefilled edit form
exports.showEdit = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.redirect("/jobs");
    }

    const job = await Job.findByPk(id, { include: "attachments" });
    if (!job) {
      return res.redirect("/jobs");
    }

    const categories = await Category.findAll({
      where: { status: "active" },
      order: [["name", "ASC"]],
    });

    const jobData = job.toJSON();
    jobData.attachments = (jobData.attachments || []).map(withImageFlag);

    res.render("job/editJobs.handlebars", {
      job: jobData,
      categories: categories.map((category) => category.toJSON()),
    });
  } catch (error) {
    console.error(error);
    res.redirect("/jobs");
  }
};

// POST /jobs/:id/edit - updates the job and its attachments.
//
// Attachment handling (all inside one transaction):
//   - req.body.attachmentStates: per-attachment lifecycle chosen in the
//     edit form, posted as attachmentStates[<id>] = "published" | "draft" |
//     "delete" (extended urlencoded parsing turns it into an object).
//     "published"/"draft" are stored on the row (draft hides the file from
//     the public pages); "delete" destroys the row and unlinks the file
//     after commit. Missing/unknown values leave the row untouched.
//   - req.files: newly uploaded files from the dropzone; metadata rows are
//     inserted as "published".
// A duplicate slug (unique index) re-renders the edit form with an error.
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      cleanupUploadedFiles(req);
      return res.redirect("/jobs");
    }

    const job = await Job.findByPk(id);
    if (!job) {
      cleanupUploadedFiles(req);
      return res.redirect("/jobs");
    }

    const {
      title,
      description,
      organization,
      categoryId,
      employmentType,
      location,
      salary,
      slug,
      deadline,
      responsibilities,
      requirements,
      qualifications,
      applicationUrl,
      applicationEmail,
      applicationInstructions,
      sourceName,
      sourceUrl,
      status,
    } = req.body;

    // Per-attachment lifecycle from the edit form: { "<id>": "published" | "draft" | "delete" }.
    // Keys are Number()-ed and filtered so garbage ids are ignored; garbage
    // values are ignored too (rows are only touched by an exact, known value).
    const rawStates = req.body.attachmentStates;
    const attachmentStates = new Map();
    if (rawStates && typeof rawStates === "object") {
      for (const [rawId, rawState] of Object.entries(rawStates)) {
        const id = Number(rawId);
        if (Number.isInteger(id) && id > 0) {
          attachmentStates.set(id, String(rawState));
        }
      }
    }

    // Empty slug input keeps the current slug; otherwise normalize it the
    // same way as on create.
    const nextSlug = slug && slug.trim() ? generateSlug(slug) : job.slug;

    // Status BEFORE the edit - used to detect the "became published"
    // transition for the Telegram announcement.
    const previousStatus = job.status;

    const transaction = await db.transaction();
    const filesToDelete = [];

    try {
      await job.update(
        {
          title,
          description,
          companyName: organization,
          categoryId: categoryId || null,
          employmentType: employmentType || job.employmentType,
          location: location || "Ethiopia",
          salary,
          slug: nextSlug,
          deadline: deadline || null,
          responsibilities,
          requirements,
          qualifications,
          applicationUrl,
          applicationEmail,
          applicationInstructions,
          sourceName,
          sourceUrl,
          status,
        },
        { transaction },
      );

      // Apply the chosen lifecycle to each mentioned attachment. Scoped by
      // jobId so a forged id can never touch another job's files. Rows not
      // mentioned in the form (or with an unknown value) are left as-is.
      if (attachmentStates.size > 0) {
        const rows = await JobAttachment.findAll({
          where: {
            id: { [Op.in]: [...attachmentStates.keys()] },
            jobId: job.id,
          },
          transaction,
        });

        const deleteIds = [];

        for (const row of rows) {
          const state = attachmentStates.get(row.id);

          if (state === "published" || state === "draft") {
            await row.update({ status: state }, { transaction });
          } else if (state === "delete") {
            deleteIds.push(row.id);
            filesToDelete.push(path.join(UPLOAD_DIR, row.storedName));
          }
        }

        if (deleteIds.length > 0) {
          await JobAttachment.destroy({
            where: { id: { [Op.in]: deleteIds } },
            transaction,
          });
        }
      }

      // Persist metadata for newly uploaded files (already on disk).
      if (req.files && req.files.length > 0) {
        await JobAttachment.bulkCreate(
          req.files.map((file) => ({
            jobId: job.id,
            storedName: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            status: "published",
          })),
          { transaction },
        );
      }

      await transaction.commit();

      // Only unlink removed files after a successful commit.
      for (const filePath of filesToDelete) {
        fs.promises.unlink(filePath).catch((unlinkError) => {
          if (unlinkError.code !== "ENOENT") {
            console.error("Unable to remove attachment file:", unlinkError);
          }
        });
      }

      // Announce when the edit form flips a job to published (draft/
      // expired/archived -> published; republish re-announces by design).
      // Fire-and-forget, same reasoning as in create.
      if (job.status === "published" && previousStatus !== "published") {
        notifyJobPublished(job).catch(() => {});
      }

      res.redirect(`/jobs/${job.slug}`);
    } catch (error) {
      await transaction.rollback().catch(() => {});

      // Remove any files that were saved before the failure.
      cleanupUploadedFiles(req);

      if (error instanceof UniqueConstraintError) {
        const [categories, editJob] = await Promise.all([
          loadCategories(),
          loadEditJob(req),
        ]);

        return res.status(422).render("job/editJobs.handlebars", {
          categories,
          job: editJob,
          errors: { slug: "This slug is already used by another job." },
          formData: req.body,
        });
      }

      throw error;
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to update job");
  }
};

// POST /jobs/:id/delete - archives the job instead of deleting it.
//
// Nothing is removed: the job row, its attachment rows and the files on
// disk all stay, so a mistake is undoable and old postings remain
// available for reference. Archived jobs disappear from every public page
// because all public queries filter status = "published". Restore from the
// admin jobs list (Restore button / status dropdown); the job comes back
// as a draft for review before republishing.
exports.destroy = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.redirect("/jobs");
    }

    const job = await Job.findByPk(id);
    if (!job) {
      return res.redirect("/jobs");
    }

    await job.update({ status: "archived" });

    res.redirect("/admin/jobs");
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to archive job");
  }
};
