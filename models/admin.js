const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Admin accounts for the /admin panel. Passwords are stored as bcrypt
// hashes (password_hash) - never in plaintext. Seeded via
// scripts/createAdmin.js using ADMIN_USERNAME / ADMIN_PASSWORD from .env.
const Admin = sequelize.define(
    'Admin',
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        username: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },

        passwordHash: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'password_hash'
        }
    },
    {
        tableName: 'admin',

        timestamps: true,

        createdAt: 'created_at',
        updatedAt: 'updated_at',

        indexes: [
            {
                name: 'idx_admin_username',
                fields: ['username'],
                unique: true
            }
        ]
    }
);

module.exports = Admin;
