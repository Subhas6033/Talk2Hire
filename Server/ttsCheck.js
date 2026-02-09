require("dotenv").config();
const migration = require("./migration.js");

(async () => {
  try {
    console.log("🔧 Starting DB migration...");

    await migration.up();

    console.log("🎉 Migration executed successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:");
    console.error(err);
    process.exit(1);
  }
})();
