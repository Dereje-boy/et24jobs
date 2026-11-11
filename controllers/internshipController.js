const { Internship } = require("../models");
const { Op } = require("sequelize");

exports.index = async (req, res) => {
  const internships = await Internship.findAll();
  res.render("internship/index.handlebars", {
    pageTitle: "Internships | ET24Jobs",
    pageDescription:
      "Find the latest internships and training opportunities on ET24Jobs.",
    pageCss: "/css/pages/internships.css",
    internships: internships
      .slice(0, 10)
      .map((internship) => internship.toJSON()),
  });
};
exports.detail = async (req, res) => {
  try {
    const internship = await Internship.findOne({
      where: {
        slug: req.params.slug,
        status: "published",
      },
    });

    if (!internship) {
      return res.redirect("/internships");
    }

    const relatedInternships = await Internship.findAll({
      where: {
        id: {
          [Op.ne]: internship.id,
        },
        status: "published",
      },

      order: [["created_At", "DESC"]],

      limit: 6,
    });

    res.render("internship/detail", {
      pageTitle: `${internship.title} | ET24Jobs`,
      pageDescription: `${internship.title} internship at ${internship.organizationName} — eligibility, duration, benefits, deadline and application information on ET24Jobs.`,
      pageCss: "/css/pages/internship-detail.css",
      internship: internship.toJSON(),
      relatedInternships: relatedInternships.slice(0, 5).map((i) => i.toJSON()),
    });
  } catch (error) {
    console.error(error);

    res.status(500).send("Something went wrong.");
  }
};

exports.post = (req, res) => {
  // res.render("internship/post");
  res.send("Internship post page is under construction.");
};
