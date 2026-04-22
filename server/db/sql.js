// server/db/sql.js
const sql = require('mssql');

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,           // Required for Azure SQL
    trustServerCertificate: false,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool;

async function connectSQL() {
  pool = await sql.connect(config);
  return pool;
}

function getPool() {
  if (!pool) throw new Error('SQL pool not initialized. Call connectSQL() first.');
  return pool;
}

// Helper: run a parameterized query
async function query(queryString, params = {}) {
  const p = getPool();
  const request = p.request();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      request.input(key, sql.NVarChar, null);
    } else {
      request.input(key, value);
    }
  }
  return request.query(queryString);
}

module.exports = { connectSQL, getPool, query, sql };
