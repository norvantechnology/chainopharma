const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (pool) return pool;

  const sslMode = String(process.env.DB_SSL || "").toLowerCase();
  const ssl = sslMode === "disable" || sslMode === "false" || sslMode === "0" ? false : { rejectUnauthorized: false };

  pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl
  });

  return pool;
}

module.exports = { getPool };

