const { Scholarship } = require("../models");
const { Op } = require("sequelize");

exports.index = async (req, res) => {
  try {
    const scholarships = await Scholarship.findAll();
    // console.log('Scholarships fetched:', scholarships[0]);

    res.render("scholarship/index", {
      scholarships: scholarships.map((scholarship) => scholarship.toJSON()),
    });

    // res.send(scholarships);
  } catch (error) {
    console.error(error);

    res.status(500).send("Unable to load scholarships");
  }
};

exports.detail = async (req, res) => {
  const scholarship = await Scholarship.findOne({
    where: {
      slug: req.params.slug,
      status: "published",
    },
  });

  if (!scholarship) {
    return res.redirect("/scholarships");
  }

  const relatedScholarships = await Scholarship.findAll({
    where: {
      id: {
        [Op.ne]: scholarship.id,
      },
      status: "published",
    },

    order: [["created_At", "DESC"]],

    limit: 6,
  });

  res.render("scholarship/detail", {
    scholarship: scholarship.toJSON(),
    relatedScholarships: relatedScholarships.slice(0, 5).map((s) => s.toJSON()),
  });
};

exports.post = (req, res) => {
  // res.render("scholarship/post");
  res.send("Scholarship post page is under construction.");
};
