const { pool } = require("./Config/database.config.js");

/* ─────────────────────────────────────────────────────────────────────────────
   CREATE TABLE statements for every table required by the recording +
   evaluation pipeline that is NOT already in your schema.

   Your existing tables (no changes needed):
     company_detail, jobs, users,
     interview_audio, interview_audio_chunks,
     interview_evaluations,          ← written by evaluation.service.js
     interview_questions,            ← stores Q text AND answer text (answer col)
     interview_screen_recordings,
     interview_video_chunks,
     interview_videos,
     interviews,
     interview_violations

   Tables this migration creates (3 new):
     1. question_evaluations          ← per-question AI scores
     2. skill_evaluations             ← per-technology skill scores
     3. interview_recording_analysis  ← lightweight summary for REST polling

   Columns this migration adds to existing tables (3 new):
     4. interview_violations.clip_url       ← public FTP URL of the cut clip
     5. interview_violations.clip_ftp_path  ← internal FTP path
     6. interview_violations.clip_status    ← pipeline state tracking
   ───────────────────────────────────────────────────────────────────────────── */

const MIGRATIONS = [
  /* ── 1. question_evaluations ────────────────────────────────────────────────
     One row per answered question.
     Populated by Evaluation.saveQuestionEvaluation() inside evaluation.service.js
     ───────────────────────────────────────────────────────────────────────── */
  {
    table: "applications",
    sql: `
      CREATE TABLE IF NOT EXISTS applications (
        id          BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,

        user_id     BIGINT UNSIGNED  NOT NULL
                      COMMENT 'FK → users.id',
        job_id      BIGINT UNSIGNED  NOT NULL
                      COMMENT 'FK → jobs.id',

        status      ENUM(
                      'applied',
                      'screening',
                      'interviewing',
                      'offer',
                      'rejected'
                    ) NOT NULL DEFAULT 'applied',

        starred     TINYINT(1)       NOT NULL DEFAULT 0
                      COMMENT '1 = starred by candidate',

        notes       TEXT             NULL
                      COMMENT 'Candidate personal notes about this application',

        created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME         NULL     ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_user_job (user_id, job_id),
        INDEX idx_user   (user_id),
        INDEX idx_job    (job_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Candidate job applications with pipeline status tracking';
    `,
  },

  /* ── 0b. applications — verify FKs exist (informational only) ─────────────
     MySQL will enforce FKs only if both parent tables exist.
     If you want hard FK constraints, run this after table creation.
     ───────────────────────────────────────────────────────────────────────── */
  {
    table: "applications (foreign keys)",
    sql: `
      ALTER TABLE applications
        ADD CONSTRAINT IF NOT EXISTS fk_app_user
          FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
        ADD CONSTRAINT IF NOT EXISTS fk_app_job
          FOREIGN KEY (job_id)  REFERENCES jobs(id)   ON DELETE CASCADE;
    `,
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Inspection helpers
   ───────────────────────────────────────────────────────────────────────────── */

async function inspectTable(connection, tableName) {
  const [exists] = await connection.query(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = '${tableName}';
  `);

  if (exists.length === 0) {
    console.log(`❌  '${tableName}' does NOT exist`);
    return false;
  }

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

  const [fks] = await connection.query(`
    SELECT
      COLUMN_NAME                AS \`Column\`,
      REFERENCED_TABLE_NAME      AS \`References Table\`,
      REFERENCED_COLUMN_NAME     AS \`References Column\`
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA              = DATABASE()
      AND TABLE_NAME                = '${tableName}'
      AND REFERENCED_TABLE_NAME IS NOT NULL;
  `);
  if (fks.length > 0) {
    console.log(`🔗  Foreign keys:\n`);
    console.table(fks);
  }

  const [indexes] = await connection.query(`SHOW INDEX FROM \`${tableName}\`;`);
  if (indexes.length > 0) {
    console.log(`🗂️   Indexes:\n`);
    console.table(
      indexes.map((i) => ({
        Key: i.Key_name,
        Column: i.Column_name,
        Unique: i.Non_unique === 0 ? "YES" : "NO",
        Type: i.Index_type,
      })),
    );
  }

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
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main
   ───────────────────────────────────────────────────────────────────────────── */

const inspect = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("✅ Connected to database\n");

    // ── STEP 1: Run migrations ─────────────────────────────────────────────
    console.log("🔧  Running migrations…\n");
    for (const { table, sql } of MIGRATIONS) {
      try {
        await connection.query(sql);
        console.log(`✅  '${table}' — ready`);
      } catch (err) {
        console.error(`❌  '${table}' migration failed: ${err.message}`);
      }
    }
    console.log();

    // ── STEP 2: Inspect ALL tables (existing + newly created) ─────────────
    const ALL_TABLES = [
      // ── Your existing tables ──────────────────────────────────────────────
      "interviews",
      "interview_questions",
      "interview_evaluations",
      "interview_videos",
      "interview_video_chunks",
      "interview_screen_recordings",
      "interview_audio",
      "interview_audio_chunks",
      "interview_violations", // ← now has clip_url / clip_ftp_path / clip_status
      // ── Newly created tables ──────────────────────────────────────────────
      "question_evaluations",
      "skill_evaluations",
      "interview_recording_analysis",
    ];

    console.log("🔍  Inspecting all tables…\n");
    for (const tableName of ALL_TABLES) {
      await inspectTable(connection, tableName);
    }

    // ── STEP 3: Verify interview_questions has an 'answer' column ──────────
    console.log("🔎  Checking interview_questions.answer column…");
    const [answerCol] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'interview_questions'
        AND COLUMN_NAME  = 'answer';
    `);

    if (answerCol.length === 0) {
      console.warn(
        "⚠️  'answer' column NOT found in interview_questions — adding it now…",
      );
      await connection.query(`
        ALTER TABLE interview_questions
          ADD COLUMN answer        TEXT     NULL AFTER question,
          ADD COLUMN answered_at   DATETIME NULL AFTER answer;
      `);
      console.log(
        "✅  'answer' and 'answered_at' columns added to interview_questions",
      );
    } else {
      console.log(
        "✅  interview_questions.answer column exists:",
        answerCol[0],
      );
    }

    // ── STEP 4: Chunk tracking summary ────────────────────────────────────
    const [chunkSummary] = await connection
      .query(
        `
        SELECT
          interview_id,
          video_type,
          COUNT(*)          AS total_chunks,
          MIN(chunk_number) AS first_chunk,
          MAX(chunk_number) AS last_chunk,
          SUM(chunk_size)   AS total_bytes_stored
        FROM interview_video_chunks
        GROUP BY interview_id, video_type
        ORDER BY interview_id, video_type;
      `,
      )
      .catch(() => [[]]);

    if (chunkSummary.length > 0) {
      console.log("\n📦  Chunk tracking summary (interview_video_chunks):\n");
      console.table(chunkSummary);
    }

    // ── STEP 5: Analysis completion summary ───────────────────────────────
    const [analysisSummary] = await connection
      .query(
        `
        SELECT
          a.interview_id,
          a.overall_score,
          a.hire_decision,
          a.experience_level,
          a.total_questions,
          a.analysed_at,
          COUNT(qe.id) AS questions_scored
        FROM interview_recording_analysis a
        LEFT JOIN question_evaluations qe ON qe.interview_id = a.interview_id
        GROUP BY a.interview_id
        ORDER BY a.analysed_at DESC
        LIMIT 10;
      `,
      )
      .catch(() => [[]]);

    if (analysisSummary.length > 0) {
      console.log("\n📊  Recent analysis results:\n");
      console.table(analysisSummary);
    }

    // ── STEP 6: Violation clip summary ────────────────────────────────────
    const [clipSummary] = await connection
      .query(
        `
        SELECT
          interview_id,
          violation_type,
          COUNT(*)                                          AS total_violations,
          SUM(clip_status = 'completed')                    AS clips_ready,
          SUM(clip_status = 'pending')                      AS clips_pending,
          SUM(clip_status = 'processing')                   AS clips_processing,
          SUM(clip_status = 'failed')                       AS clips_failed,
          ROUND(AVG(duration_seconds), 2)                   AS avg_duration_sec
        FROM interview_violations
        GROUP BY interview_id, violation_type
        ORDER BY interview_id, violation_type;
      `,
      )
      .catch(() => [[]]);

    if (clipSummary.length > 0) {
      console.log("\n✂️   Violation clip summary (interview_violations):\n");
      console.table(clipSummary);
    }
  } catch (err) {
    console.error("❌ Script failed:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

inspect();
