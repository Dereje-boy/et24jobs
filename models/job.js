const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Job = sequelize.define(
    'Job',
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        slug: {
            type: DataTypes.STRING(300),
            allowNull: false,
            unique: true
        },

        companyName: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'company_name'
        },

        companyInitials: {
            type: DataTypes.STRING(10),
            allowNull: true,
            field: 'company_initials'
        },

        categoryId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true,
            field: 'category_id'
        },

        location: {
            type: DataTypes.STRING(150),
            allowNull: false,
            defaultValue: 'Ethiopia'
        },

        employmentType: {
            type: DataTypes.ENUM(
                'full-time',
                'part-time',
                'contract',
                'temporary',
                'internship',
                'volunteer'
            ),
            allowNull: false,
            defaultValue: 'full-time',
            field: 'employment_type'
        },

        salary: {
            type: DataTypes.STRING(150),
            allowNull: true
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },

        requirements: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        responsibilities: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        qualifications: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        deadline: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },

        applicationUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: 'application_url'
        },

        applicationEmail: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'application_email'
        },

        applicationInstructions: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'application_instructions'
        },

        sourceName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'source_name'
        },

        sourceUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: 'source_url'
        },

        status: {
            type: DataTypes.ENUM(
                'draft',
                'published',
                'expired',
                'archived'
            ),
            allowNull: false,
            defaultValue: 'draft'
        },

        views: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },

        publishedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'published_at'
        }
    },
    {
        tableName: 'jobs',

        timestamps: true,

        createdAt: 'created_at',
        updatedAt: 'updated_at',

        indexes: [
            {
                name: 'idx_jobs_status_created',
                fields: ['status', 'created_at']
            },
            {
                name: 'idx_jobs_category',
                fields: ['category_id']
            },
            {
                name: 'idx_jobs_location',
                fields: ['location']
            },
            {
                name: 'idx_jobs_employment_type',
                fields: ['employment_type']
            },
            {
                name: 'idx_jobs_deadline',
                fields: ['deadline']
            },
            {
                name: 'idx_jobs_published_at',
                fields: ['published_at']
            },
            {
                name: 'idx_jobs_company',
                fields: ['company_name']
            }
        ]
    }
);

module.exports = Job;