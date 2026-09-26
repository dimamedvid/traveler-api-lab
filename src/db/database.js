const { Pool, types } = require("pg");

// PostgreSQL DATE (OID 1082) повертаємо як рядок YYYY-MM-DD,
// щоб дата не змінювалась через часовий пояс.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;