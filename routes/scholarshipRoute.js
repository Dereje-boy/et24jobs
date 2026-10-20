const express = require("express");

const router = express.Router();

const scholarshipController = require("../controllers/scholarshipController");

router.get("/", scholarshipController.index);
router.get("/post", scholarshipController.post);
router.get("/:slug", scholarshipController.detail);

module.exports = router;
