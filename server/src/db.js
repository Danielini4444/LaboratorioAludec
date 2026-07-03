const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/lab'
});

module.exports = { pool, query: (text, params) => pool.query(text, params) };
