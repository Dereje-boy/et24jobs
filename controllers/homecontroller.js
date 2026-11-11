const { Job, Scholarship, Internship } = require("../models");

// Head data for the shared layout.
const PAGE_LOCALS = {
  pageTitle: "ET24Jobs - Jobs, Scholarships & Internship",
  pageDescription:
    "Find the latest jobs, scholarships and internships on ET24Jobs.",
  pageCss: "/css/pages/home.css",
};

exports.home = async (req, res) => {
  try {
    const latestJobs = await Job.findAll({
      where: {
        status: "published",
      },

      order: [["created_At", "DESC"]],

      limit: 6,
    });

    const latestScholarships = await Scholarship.findAll({
      where: {
        status: "published",
      },

      order: [["created_At", "DESC"]],

      limit: 6,
    });

    const latestInternships = await Internship.findAll({
      where: {
        status: "published",
      },

      order: [["created_At", "DESC"]],

      limit: 6,
    });

    res.render("index", {
      ...PAGE_LOCALS,
      latestJobs: latestJobs.map((job) => job.toJSON()),
      latestScholarships: latestScholarships.map((scholarship) =>
        scholarship.toJSON(),
      ),
      latestInternships: latestInternships.map((internship) =>
        internship.toJSON(),
      ),
    });
  } catch (error) {
    console.error(error);

    // res.status(500).send("Unable to load homepage.");
    // res.render("error", { message: "Unable to load homepage." });
    res.render("index", PAGE_LOCALS);
  }
};
