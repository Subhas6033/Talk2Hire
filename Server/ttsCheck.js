// scripts/runMigration.js
require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await db.execute(`
    ALTER TABLE users
    ADD COLUMN skill VARCHAR(255) NULL;
  `);

  console.log("✅ Migration applied");
  process.exit();
})();
