const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.APP_DB_HOST || process.env.DB_HOST || 'localhost',
  user: process.env.APP_DB_USER || process.env.DB_USER || 'admin',
  password: process.env.APP_DB_PASSWORD || process.env.DB_PASSWORD || 'lab-password',
  database: process.env.APP_DB_NAME || process.env.DB_NAME || 'serviceday_db',
  port: process.env.APP_DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
