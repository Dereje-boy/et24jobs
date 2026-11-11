const db = require("../config/database");
const Job = require("./job");
const Category = require("./category");
const Scholarship = require("./scholarship");
const Internship = require("./internship");
const JobAttachment = require("./jobAttachment");
const Admin = require("./admin");
const Session = require("./session");

// Relationships
Category.hasMany(Job, {
  foreignKey: "categoryId",
  as: "jobs",
});

Job.belongsTo(Category, {
  foreignKey: "categoryId",
  as: "category",
});

Job.hasMany(JobAttachment, {
  foreignKey: "jobId",
  as: "attachments",
  onDelete: "CASCADE",
});

JobAttachment.belongsTo(Job, {
  foreignKey: "jobId",
  as: "job",
});

Category.hasMany(Internship, {
  foreignKey: "categoryId",
  as: "internships",
});

Internship.belongsTo(Category, {
  foreignKey: "categoryId",
  as: "category",
});

module.exports = {
  db,
  Job,
  Category,
  Scholarship,
  Internship,
  JobAttachment,
  Admin,
  Session,
};
