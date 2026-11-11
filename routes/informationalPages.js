const express = require("express");

const router = express.Router();

router.get("/about", (req, res) => {
  res.render("about", {
    pageTitle: "About Us | ET24Jobs",
    pageDescription:
      "Learn more about ET24Jobs, a platform for discovering jobs, scholarships and internships.",
    pageCss: "/css/pages/about.css",
  });
});

router.get("/contact", (req, res) => {
  res.render("contact", {
    pageTitle: "Contact Us | ET24Jobs",
    pageDescription:
      "Contact ET24Jobs regarding jobs, scholarships, internships, corrections and other inquiries.",
    pageCss: "/css/pages/contact.css",
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
  res.render("privacy-policy", {
    pageTitle: "Privacy Policy | ET24Jobs",
    pageDescription:
      "ET24Jobs Privacy Policy explaining how information, cookies and advertising technologies may be used.",
    pageCss: "/css/pages/privacy-policy.css",
  });
});

router.get("/terms", (req, res) => {
  res.render("terms", {
    pageTitle: "Terms & Conditions | ET24Jobs",
    pageDescription: "Terms and Conditions governing the use of ET24Jobs.",
    pageCss: "/css/pages/terms.css",
  });
});

module.exports = router;
