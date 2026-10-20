const express = require("express");

const router = express.Router();

const internshipController = require("../controllers/internshipController.js");

router.get("/", internshipController.index);
router.get("/post", internshipController.post);
router.get("/:slug", internshipController.detail);

module.exports = router;
