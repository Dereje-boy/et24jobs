const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Scholarship = sequelize.define(
    'Scholarship',
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

        providerName: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'provider_name'
        },

        providerWebsite: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: 'provider_website'
        },

        scholarshipType: {
            type: DataTypes.STRING(150),
            allowNull: true,
            field: 'scholarship_type'
        },

        studyLevel: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'study_level'
        },

        fieldOfStudy: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: 'field_of_study'
        },

        hostCountry: {
            type: DataTypes.STRING(150),
            allowNull: true,
            field: 'host_country'
        },

        hostInstitution: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'host_institution'
        },

        studyMode: {
            type: DataTypes.ENUM(
                'on-campus',
                'online',
                'hybrid'
            ),
            allowNull: true,
            field: 'study_mode'
        },

        fundingType: {
            type: DataTypes.ENUM(
                'fully-funded',
                'partially-funded',
                'tuition-only',
                'stipend',
                'other'
            ),
            allowNull: true,
            field: 'funding_type'
        },

        fundingDetails: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'funding_details'
        },

        eligibility: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        requirements: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: false
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
        tableName: 'scholarships',

        timestamps: true,

        createdAt: 'created_at',
        updatedAt: 'updated_at',

        indexes: [
            {
                name: 'idx_scholarships_status_created',
                fields: ['status', 'created_at']
            },
            {
                name: 'idx_scholarships_deadline',
                fields: ['deadline']
            },
            {
                name: 'idx_scholarships_provider',
                fields: ['provider_name']
            },
            {
                name: 'idx_scholarships_host_country',
                fields: ['host_country']
            },
            {
                name: 'idx_scholarships_study_level',
                fields: ['study_level']
            },
            {
                name: 'idx_scholarships_funding_type',
                fields: ['funding_type']
            },
            {
                name: 'idx_scholarships_published_at',
                fields: ['published_at']
            }
        ]
    }
);

module.exports = Scholarship;