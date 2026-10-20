const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Session storage for express-session, backed by connect-session-sequelize.
//
// connect-session-sequelize, when created with { table: 'sessions' }, looks
// up the model named "Session" on the Sequelize instance and uses it for all
// session persistence (get/set/touch/destroy/expiry cleanup). Defining it
// here gives us full control over the column mappings so they match the
// manually created `sessions` table (created_at / updated_at), consistent
// with the rest of the app's models.
//
// The store reads/writes:
//   sid     - session id (cookie value), primary key
//   expires - absolute expiry timestamp, pruned automatically by the store
//   data    - JSON-serialized session payload ({ adminId, adminUsername, cookie })
const Session = sequelize.define(
    'Session',
    {
        sid: {
            type: DataTypes.STRING(36),
            allowNull: false,
            primaryKey: true
        },

        expires: {
            type: DataTypes.DATE,
            allowNull: true
        },

        data: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    },
    {
        tableName: 'sessions',

        timestamps: true,

        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
);

module.exports = Session;
