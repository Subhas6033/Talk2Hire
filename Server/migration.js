const { connectDB } = require("./Config/database.config.js");

module.exports.up = async () => {
  const db = await connectDB();

  console.log("🚀 Running migration: make skill default");

  await db.execute(`
    ALTER TABLE users
    MODIFY COLUMN skill VARCHAR(255) NOT NULL DEFAULT '';
  `);

  console.log("✅ Migration UP completed");
};

module.exports.down = async () => {
  const db = await connectDB();

  console.log("↩️ Reverting migration: remove skill default");

  await db.execute(`
    ALTER TABLE users
    MODIFY COLUMN skill TEXT NOT NULL;
  `);

  console.log("✅ Migration DOWN completed");
};
