const express = require("express");

const router = express.Router();

const adminAuthController = require("../controllers/adminAuthController");
const adminController = require("../controllers/adminController");
const { requireAdmin } = require("../Middlewares/requireAdmin");

// Login / logout
router.get("/login", adminAuthController.showLogin);
router.post("/login", adminAuthController.login);
router.post("/logout", requireAdmin, adminAuthController.logout);

// Everything below requires a logged-in admin
router.use(requireAdmin);

// Dashboard
router.get("/", adminController.dashboard);

// Per-entity manage lists
router.get("/jobs", adminController.listJobs);
router.get("/scholarships", adminController.listScholarships);
router.get("/internships", adminController.listInternships);

// Generic delete + quick status switch (jobs | scholarships | internships)
router.post("/:entity/:id/delete", adminController.destroyEntity);
router.post("/:entity/:id/status", adminController.updateStatus);

module.exports = router;
