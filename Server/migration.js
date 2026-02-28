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
   ───────────────────────────────────────────────────────────────────────────── */

const MIGRATIONS = [
  /* ── 1. question_evaluations ────────────────────────────────────────────────
     One row per answered question.
     Populated by Evaluation.saveQuestionEvaluation() inside evaluation.service.js
     ───────────────────────────────────────────────────────────────────────── */
  {
    table: "question_evaluations",
    sql: `
      CREATE TABLE IF NOT EXISTS question_evaluations (
        id            BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,

        interview_id  BIGINT UNSIGNED  NOT NULL
                        COMMENT 'FK → interviews.id',
        question_id   BIGINT UNSIGNED  NOT NULL
                        COMMENT 'FK → interview_questions.id',

        -- AI scores (all 0-100)
        score         TINYINT UNSIGNED NOT NULL DEFAULT 0
                        COMMENT 'Overall answer score',
        correctness   TINYINT UNSIGNED NOT NULL DEFAULT 0,
        depth         TINYINT UNSIGNED NOT NULL DEFAULT 0,
        clarity       TINYINT UNSIGNED NOT NULL DEFAULT 0,
        confidence    TINYINT UNSIGNED NOT NULL DEFAULT 0,

        -- Classification
        quality         VARCHAR(20) NULL  COMMENT 'strong | average | weak | irrelevant',
        detected_level  VARCHAR(20) NULL  COMMENT 'BEGINNER | INTERMEDIATE | ADVANCED',

        -- Narrative
        feedback      TEXT         NULL,
        strengths     JSON         NULL  COMMENT 'Array of strength strings',
        weaknesses    JSON         NULL  COMMENT 'Array of weakness strings',

        -- Source tracing
        eval_source   VARCHAR(20)  NOT NULL DEFAULT 'ai'
                        COMMENT 'ai | pre_validation | fallback',

        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME     NULL     ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_question (interview_id, question_id),
        INDEX idx_interview (interview_id),
        INDEX idx_question  (question_id),
        INDEX idx_score     (score)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Per-question AI evaluation scores';
    `,
  },

  /* ── 2. skill_evaluations ───────────────────────────────────────────────────
     One row per technology/skill within an interview.
     Populated by Evaluation.saveSkillEvaluation() inside evaluation.service.js
     ───────────────────────────────────────────────────────────────────────── */
  {
    table: "skill_evaluations",
    sql: `
      CREATE TABLE IF NOT EXISTS skill_evaluations (
        id            BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,

        interview_id  BIGINT UNSIGNED  NOT NULL
                        COMMENT 'FK → interviews.id',
        technology    VARCHAR(100)     NOT NULL
                        COMMENT 'e.g. React, Node.js, SQL',

        average_score TINYINT UNSIGNED NOT NULL DEFAULT 0
                        COMMENT '0-100 average across questions for this tech',
        level         VARCHAR(20)      NOT NULL DEFAULT 'BEGINNER'
                        COMMENT 'BEGINNER | INTERMEDIATE | ADVANCED',

        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME NULL     ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_skill (interview_id, technology),
        INDEX idx_interview  (interview_id),
        INDEX idx_technology (technology),
        INDEX idx_score      (average_score)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Per-technology skill scores aggregated across an interview';
    `,
  },

  /* ── 3. interview_recording_analysis ────────────────────────────────────────
     Lightweight summary row written during the 5-minute video-merge window.
     Used by GET /:interviewId/analysis for fast REST polling.
     Full scores live in question_evaluations / interview_evaluations.
     ───────────────────────────────────────────────────────────────────────── */
  {
    table: "interview_recording_analysis",
    sql: `
      CREATE TABLE IF NOT EXISTS interview_recording_analysis (
        id               BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,

        interview_id     BIGINT UNSIGNED  NOT NULL
                           COMMENT 'FK → interviews.id',
        user_id          BIGINT UNSIGNED  NULL
                           COMMENT 'FK → users.id',

        -- Overall verdict
        overall_score    TINYINT UNSIGNED NOT NULL DEFAULT 0
                           COMMENT '0-100 weighted average across all questions',
        hire_decision    ENUM('YES','MAYBE','NO') NOT NULL DEFAULT 'NO',
        experience_level ENUM('BEGINNER','INTERMEDIATE','ADVANCED')
                           NOT NULL DEFAULT 'BEGINNER',
        total_questions  TINYINT UNSIGNED NOT NULL DEFAULT 0,

        -- AI-generated narrative
        strengths        TEXT NULL  COMMENT 'Bullet-pointed key strengths',
        weaknesses       TEXT NULL  COMMENT 'Bullet-pointed improvement areas',
        summary          TEXT NULL  COMMENT '2-3 paragraph overall assessment',

        -- Timestamps
        analysed_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME NULL     ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_interview (interview_id),
        INDEX idx_user      (user_id),
        INDEX idx_hire      (hire_decision),
        INDEX idx_analysed  (analysed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Lightweight analysis summary produced during the video merge window';
    `,
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Inspection helpers  (same style as your existing inspect script)
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
      "interview_questions", // stores question text + answer text (answer col)
      "interview_evaluations", // overall evaluation written by evaluation.service.js
      "interview_videos",
      "interview_video_chunks",
      "interview_screen_recordings",
      "interview_audio",
      "interview_audio_chunks",
      "interview_violations",
      // ── Newly created tables ──────────────────────────────────────────────
      "question_evaluations", // per-question AI scores
      "skill_evaluations", // per-technology skill scores
      "interview_recording_analysis", // lightweight REST-polling summary
    ];

    console.log("🔍  Inspecting all tables…\n");
    for (const tableName of ALL_TABLES) {
      await inspectTable(connection, tableName);
    }

    // ── STEP 3: Verify interview_questions has an 'answer' column ──────────
    // The evaluation service reads q.answer from this table.
    // If your column is named differently, rename it or add it below.
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
          COUNT(*)         AS total_chunks,
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
  } catch (err) {
    console.error("❌ Script failed:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

inspect();
