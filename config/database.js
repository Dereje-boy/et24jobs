const {Sequelize }= require('sequelize');
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,
        // Managed MySQL requires TLS; DB_SSL=true encrypts without verifying
        // the provider's CA (most hosting providers' certs are not in Node's
        // trust store). Leave unset/false for a local MySQL server.
        dialectOptions: String(process.env.DB_SSL).toLowerCase() === 'true'
            ? { ssl: { rejectUnauthorized: false } }
            : undefined
    })

module.exports = sequelize;