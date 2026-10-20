const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Internship = sequelize.define(
    'Internship',
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

        organizationName: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'organization_name'
        },

        organizationWebsite: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: 'organization_website'
        },

        categoryId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true,
            field: 'category_id'
        },

        internshipType: {
            type: DataTypes.ENUM(
                'full-time',
                'part-time',
                'remote',
                'hybrid',
                'on-site'
            ),
            allowNull: true,
            field: 'internship_type'
        },

        duration: {
            type: DataTypes.STRING(100),
            allowNull: true
        },

        location: {
            type: DataTypes.STRING(150),
            allowNull: true
        },

        fieldOfStudy: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: 'field_of_study'
        },

        studyLevel: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'study_level'
        },

        compensationType: {
            type: DataTypes.ENUM(
                'paid',
                'unpaid',
                'stipend',
                'allowance',
                'unknown'
            ),
            allowNull: false,
            defaultValue: 'unknown',
            field: 'compensation_type'
        },

        compensationDetails: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'compensation_details'
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },

        responsibilities: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        requirements: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        eligibility: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        benefits: {
            type: DataTypes.TEXT,
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

        deadline: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },

        startDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            field: 'start_date'
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
        tableName: 'internships',

        timestamps: true,

        createdAt: 'created_at',
        updatedAt: 'updated_at',

        indexes: [
            {
                name: 'idx_internships_status_created',
                fields: ['status', 'created_at']
            },
            {
                name: 'idx_internships_category',
                fields: ['category_id']
            },
            {
                name: 'idx_internships_location',
                fields: ['location']
            },
            {
                name: 'idx_internships_deadline',
                fields: ['deadline']
            },
            {
                name: 'idx_internships_organization',
                fields: ['organization_name']
            },
            {
                name: 'idx_internships_study_level',
                fields: ['study_level']
            },
            {
                name: 'idx_internships_compensation',
                fields: ['compensation_type']
            },
            {
                name: 'idx_internships_published_at',
                fields: ['published_at']
            }
        ]
    }
);

module.exports = Internship;