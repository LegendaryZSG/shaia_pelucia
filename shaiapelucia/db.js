const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  port: '3308',
  user: 'root',
  password: '57789',
  database: 'shaia_pelucia',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;