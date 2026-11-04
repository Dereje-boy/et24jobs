const express = require("express");

const router = express.Router();

const jobController = require("../controllers/jobController");
const { validateJobCreate, validateJobEdit } = require("../Middlewares/validateJob");
const {
  uploadJobFiles,
  editUploadJobFiles,
} = require("../Middlewares/uploadJobFiles");
const { requireAdmin } = require("../Middlewares/requireAdmin");

router.get("/", jobController.index);
router.get("/post", requireAdmin, jobController.post);
router.post(
  "/create",
  requireAdmin,
  uploadJobFiles,
  validateJobCreate,
  jobController.create,
);

// Edit & delete (id-based, because the slug itself can change on edit).
// Declared before the /:slug catch-all so "/123/edit" is never mistaken
// for a slug.
router.get("/:id/edit", requireAdmin, jobController.showEdit);
router.post(
  "/:id/edit",
  requireAdmin,
  editUploadJobFiles,
  validateJobEdit,
  jobController.update,
);
router.post("/:id/delete", requireAdmin, jobController.destroy);

router.get("/:slug", jobController.detail);

module.exports = router;

