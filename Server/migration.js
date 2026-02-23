const { pool } = require("./Config/database.config.js");

const SCREEN_URLS = [
  "https://www.youtube.com/watch?v=JtTvCOWfqxo",
  "https://www.youtube.com/watch?v=cCaU0MkGqMs",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=9bZkp7q19f0",
];

const PRIMARY_URLS = [
  "https://www.youtube.com/watch?v=cCaU0MkGqMs&list=RDcCaU0MkGqMs&start_radio=1",
  "https://www.youtube.com/watch?v=JtTvCOWfqxo",
  "https://www.youtube.com/watch?v=9bZkp7q19f0",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
];

const MOBILE_URLS = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=9bZkp7q19f0",
  "https://www.youtube.com/watch?v=JtTvCOWfqxo",
  "https://www.youtube.com/watch?v=cCaU0MkGqMs",
];

const run = async () => {
  let connection;

  try {
    connection = await pool.getConnection();
    console.log("✅ Connected to database\n");

    // Get all existing interviews ordered by id
    const [interviews] = await connection.query(
      "SELECT id, candidate_name FROM interviews ORDER BY id ASC",
    );

    if (!interviews.length) {
      console.log("❌ No interviews found.");
      process.exit(1);
    }

    console.log(
      `Found ${interviews.length} interviews. Updating video URLs...\n`,
    );

    for (let i = 0; i < interviews.length; i++) {
      const interview = interviews[i];

      await connection.query(
        `UPDATE interviews 
         SET 
           screen_recording_url = ?,
           primary_recording_url = ?,
           mobile_recording_url = ?,
           updated_at = NOW()
         WHERE id = ?`,
        [
          SCREEN_URLS[i % SCREEN_URLS.length],
          PRIMARY_URLS[i % PRIMARY_URLS.length],
          MOBILE_URLS[i % MOBILE_URLS.length],
          interview.id,
        ],
      );

      console.log(`✅ Updated: ${interview.candidate_name}`);
    }

    console.log("\n🎉 All video URLs updated successfully!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

run();
