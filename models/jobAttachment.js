const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Metadata for files uploaded with a job (images, PDFs, any other type).
// The file contents live on disk at public/uploads/jobs/<storedName>;
// this table only records where the file is and how to serve it.
const JobAttachment = sequelize.define(
    'JobAttachment',
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        jobId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            field: 'job_id'
        },

        // Generated filename on disk (e.g. 1726000000000-a1b2c3d4e5f6.png)
        storedName: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'stored_name'
        },

        // Name the file had on the uploader's machine
        originalName: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'original_name'
        },

        mimeType: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'mime_type'
        },

        sizeBytes: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            field: 'size_bytes'
        },

        // Lifecycle state of one attachment:
        //   published - shown on the public job page
        //   draft     - hidden from the public site, still editable in the
        //               job edit form so it can be re-published later
        // (Rows whose user picked "Delete" in the edit form are destroyed;
        // there is no deleted status stored in the DB.)
        status: {
            type: DataTypes.ENUM('published', 'draft'),
            allowNull: false,
            defaultValue: 'published',
        }
    },
    {
        tableName: 'job_attachments',

        timestamps: true,

        createdAt: 'created_at',
        updatedAt: 'updated_at',

        indexes: [
            {
                name: 'idx_job_attachments_job',
                fields: ['job_id']
            }
        ]
    }
);

module.exports = JobAttachment;
