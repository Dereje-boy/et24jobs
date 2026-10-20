const express = require("express");

const router = express.Router();

router.get("/about", (req, res) => {
  res.render("about");
});

router.get("/contact", (req, res) => {
  res.render("contact", {
    contactEmail: "et24jobs@gmail.com",
  });
});

router.post("/contact", async (req, res) => {
  // Handle contact form here.

  // For now:
  console.log(req.body);
  res.redirect("/contact");
});

router.get("/privacy-policy", (req, res) => {
  res.render("privacy-policy");
});

router.get("/terms", (req, res) => {
  res.render("terms");
});

module.exports = router;
