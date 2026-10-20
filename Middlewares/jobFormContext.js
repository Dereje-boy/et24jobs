// Shared render context for re-rendering the job create/edit forms after a
// validation (Middlewares/validateJob.js) or upload (Middlewares/uploadJobFiles.js)
// failure. Both middlewares need the same data, so it lives here:
//
//   - categories: re-fetched so the dropdown renders as on a fresh page load
//   - job:        (edit only) the job being edited, with its existing
//                 attachments, so the form action URL and the attachment
//                 list still render after a failure
//
// Every loader fails soft: on database trouble the form still renders, just
// with an empty dropdown / no job.

const { Category, Job } = require("../models");

// Active categories for the dropdown; [] on failure (same as jobController.post).
const loadCategories = async () => {
  try {
    const rows = await Category.findAll({
      where: { status: "active" },
      order: [["name", "ASC"]],
    });
    return rows.map((category) => category.toJSON());
  } catch (error) {
    console.error("Unable to reload categories:", error);
    return [];
  }
};

// The job being edited (req.params.id), including existing attachments.
// Returns null when the id is invalid or the row is gone.
const loadEditJob = async (req) => {
  try {
    const job = await Job.findByPk(req.params.id, {
      include: "attachments",
    });
    return job ? job.toJSON() : null;
  } catch (error) {
    console.error("Unable to reload job:", error);
    return null;
  }
};

module.exports = { loadCategories, loadEditJob };
