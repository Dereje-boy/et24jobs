const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define(
    'Category',
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true
        },

        slug: {
            type: DataTypes.STRING(120),
            allowNull: false,
            unique: true
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        status: {
            type: DataTypes.ENUM(
                'active',
                'inactive'
            ),
            allowNull: false,
            defaultValue: 'active'
        }
    },
    {
        tableName: 'categories',

        timestamps: true,

        createdAt: 'created_at',
        updatedAt: 'updated_at',

        indexes: [
            {
                name: 'idx_categories_status',
                fields: ['status']
            }
        ]
    }
);

module.exports = Category;