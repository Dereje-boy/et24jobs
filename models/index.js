const db = require('../config/database');
const Job = require('./Job');
const Category = require('./Category');
const Scholarship = require('./Scholarship');
const Internship = require('./Internship');
const JobAttachment = require('./jobAttachment');
const Admin = require('./admin');
const Session = require('./session');

// Relationships
Category.hasMany(Job, {
    foreignKey: 'categoryId',
    as: 'jobs'
});

Job.belongsTo(Category, {
    foreignKey: 'categoryId',
    as: 'category'
});

Job.hasMany(JobAttachment, {
    foreignKey: 'jobId',
    as: 'attachments',
    onDelete: 'CASCADE'
});

JobAttachment.belongsTo(Job, {
    foreignKey: 'jobId',
    as: 'job'
});

Category.hasMany(Internship, {
    foreignKey: 'categoryId',
    as: 'internships'
});

Internship.belongsTo(Category, {
    foreignKey: 'categoryId',
    as: 'category'
});

module.exports = {
    db,
    Job,
    Category,
    Scholarship,
    Internship,
    JobAttachment,
    Admin,
    Session
};