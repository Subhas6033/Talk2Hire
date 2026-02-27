const { pool } = require("./Config/database.config.js");

const inspect = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("✅ Connected to database\n");

    const videoTables = [
      "interview_videos",
      "interview_video_chunks",
      "interview_screen_recordings",
    ];

    for (const tableName of videoTables) {
      // Check if table exists
      const [exists] = await connection.query(`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = '${tableName}';
      `);

      if (exists.length === 0) {
        console.log(`❌  '${tableName}' table does NOT exist\n`);
        continue;
      }

      // Column details
      const [cols] = await connection.query(`
        SELECT
          ORDINAL_POSITION AS \`#\`,
          COLUMN_NAME      AS \`Column\`,
          COLUMN_TYPE      AS \`Type\`,
          IS_NULLABLE      AS \`Nullable\`,
          COLUMN_DEFAULT   AS \`Default\`,
          COLUMN_KEY       AS \`Key\`,
          EXTRA            AS \`Extra\`
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = '${tableName}'
        ORDER BY ORDINAL_POSITION;
      `);

      console.log(`\n📋  '${tableName}' — ${cols.length} columns:\n`);
      console.table(cols);

      // Foreign keys
      const [fks] = await connection.query(`
        SELECT
          COLUMN_NAME        AS \`Column\`,
          REFERENCED_TABLE_NAME  AS \`References Table\`,
          REFERENCED_COLUMN_NAME AS \`References Column\`
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA       = DATABASE()
          AND TABLE_NAME         = '${tableName}'
          AND REFERENCED_TABLE_NAME IS NOT NULL;
      `);

      if (fks.length > 0) {
        console.log(`🔗  Foreign keys for '${tableName}':\n`);
        console.table(fks);
      }

      // Indexes
      const [indexes] = await connection.query(`
        SHOW INDEX FROM \`${tableName}\`;
      `);

      if (indexes.length > 0) {
        console.log(`🗂️   Indexes for '${tableName}':\n`);
        console.table(
          indexes.map((i) => ({
            Key: i.Key_name,
            Column: i.Column_name,
            Unique: i.Non_unique === 0 ? "YES" : "NO",
            Type: i.Index_type,
          })),
        );
      }

      // Row count + sample rows
      const [[{ total }]] = await connection.query(
        `SELECT COUNT(*) AS total FROM \`${tableName}\``,
      );
      console.log(`📊  Total rows: ${total}`);

      if (total > 0) {
        const [sample] = await connection.query(
          `SELECT * FROM \`${tableName}\` ORDER BY id DESC LIMIT 3`,
        );
        console.log(`\n🔍  Last 3 rows:\n`);
        console.table(sample);
      }

      console.log("─".repeat(70) + "\n");
    }

    // Cross-table chunk tracking summary (if both tables exist)
    const [chunkSummary] = await connection
      .query(
        `
      SELECT
        interview_id,
        video_type,
        COUNT(*)        AS total_chunks,
        MIN(chunk_index) AS first_chunk,
        MAX(chunk_index) AS last_chunk,
        SUM(file_size)   AS total_bytes_stored
      FROM interview_video_chunks
      GROUP BY interview_id, video_type
      ORDER BY interview_id, video_type;
    `,
      )
      .catch(() => [[]]);

    if (chunkSummary.length > 0) {
      console.log("📦  Chunk tracking summary (interview_video_chunks):\n");
      console.table(chunkSummary);
    }
  } catch (err) {
    console.error("❌ Inspection failed:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

inspect();
