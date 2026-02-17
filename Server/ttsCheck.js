/**
 * =============================================================================
 * MIGRATION RUNNER — AI Voice Interview System
 * =============================================================================
 * Usage:
 *   node migrate.js
 *
 * Requirements:
 *   - .env file in project root with DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *   - npm install mysql2 dotenv
 * =============================================================================
 */

require("dotenv").config();
const mysql = require("mysql2/promise");

// =============================================================================
// DB CONNECTION CONFIG — reads from your existing .env
// =============================================================================
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "interview_db",
  multipleStatements: false, // we run each statement individually for safety
  connectTimeout: 10000,
};

// =============================================================================
// MIGRATIONS — each entry has a name (for logging) and the SQL to run.
// Order matters. Do NOT reorder existing entries.
// =============================================================================
const MIGRATIONS = [
  // ---------------------------------------------------------------------------
  // FIX 1: interview_audio — missing columns that crash updateUploadStatus()
  //         and markAsFailed() with ER_BAD_FIELD_ERROR
  // ---------------------------------------------------------------------------
  {
    name: "interview_audio: add completed_at",
    sql: `ALTER TABLE interview_audio
            ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL DEFAULT NULL`,
  },
  {
    name: "interview_audio: add error_message",
    sql: `ALTER TABLE interview_audio
            ADD COLUMN IF NOT EXISTS error_message TEXT NULL DEFAULT NULL`,
  },
  {
    name: "interview_audio: add ftp_url",
    sql: `ALTER TABLE interview_audio
            ADD COLUMN IF NOT EXISTS ftp_url TEXT NULL DEFAULT NULL`,
  },
  {
    name: "interview_audio: add ftp_path",
    sql: `ALTER TABLE interview_audio
            ADD COLUMN IF NOT EXISTS ftp_path TEXT NULL DEFAULT NULL`,
  },
  {
    name: "interview_audio: add duration",
    sql: `ALTER TABLE interview_audio
            ADD COLUMN IF NOT EXISTS duration INT NULL DEFAULT NULL
            COMMENT 'duration in seconds'`,
  },

  // ---------------------------------------------------------------------------
  // FIX 2: interview_audio — upload_status column is too narrow.
  //         ROOT CAUSE of the "Data truncated for column 'upload_status'"
  //         console error seen in the browser. The server tries to write a
  //         value longer than the current column definition allows.
  //
  //         Known values written by the server:
  //           'pending'    →  7 chars
  //           'uploading'  →  9 chars
  //           'uploaded'   →  8 chars
  //           'processing' → 10 chars  ← this is what was being truncated
  //           'complete'   →  8 chars
  //           'failed'     →  6 chars
  //           'deleted'    →  7 chars
  //
  //         VARCHAR(50) gives plenty of headroom for any future status values.
  // ---------------------------------------------------------------------------
  {
    name: "interview_audio: widen upload_status to VARCHAR(50)",
    sql: `ALTER TABLE interview_audio
            MODIFY COLUMN upload_status VARCHAR(50) NOT NULL DEFAULT 'pending'
            COMMENT 'pending | uploading | uploaded | processing | complete | failed | deleted'`,
  },

  // ---------------------------------------------------------------------------
  // FIX 3: interview_violations — new table for Interview.saveViolation()
  //         Violations were silently dropped because the table didn't exist
  // ---------------------------------------------------------------------------
  {
    name: "interview_violations: create table",
    sql: `CREATE TABLE IF NOT EXISTS interview_violations (
            id             INT         NOT NULL AUTO_INCREMENT,
            interview_id   INT         NOT NULL,
            violation_type VARCHAR(50) NOT NULL COMMENT 'e.g. NO_FACE, MULTIPLE_FACES',
            details        TEXT        NULL,
            occurred_at    DATETIME    NOT NULL,
            created_at     DATETIME    NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id),
            INDEX idx_interview_violations_interview_id (interview_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },

  // ---------------------------------------------------------------------------
  // FIX 4: interview_audio_chunks — upload_status column may be too narrow
  //         to hold the value 'deleted' used by markChunksDeleted()
  // ---------------------------------------------------------------------------
  {
    name: "interview_audio_chunks: widen upload_status to VARCHAR(20)",
    sql: `ALTER TABLE interview_audio_chunks
            MODIFY COLUMN upload_status VARCHAR(20) NOT NULL DEFAULT 'pending'
            COMMENT 'pending | uploading | uploaded | deleted'`,
  },

  // ---------------------------------------------------------------------------
  // FIX 5: interview_questions — add unique constraint on (interview_id,
  //         question_order) to prevent duplicate inserts on race conditions
  // ---------------------------------------------------------------------------
  {
    name: "interview_questions: add unique index on (interview_id, question_order)",
    // CREATE INDEX IF NOT EXISTS is not supported in older MySQL, so we use
    // a safe procedure-style approach: ignore the error if it already exists.
    sql: `ALTER TABLE interview_questions
            ADD UNIQUE INDEX IF NOT EXISTS uq_interview_question_order
            (interview_id, question_order)`,
  },

  // ---------------------------------------------------------------------------
  // FIX 6: interview_evaluations — model_version column used by
  //         Evaluation.saveInterviewEvaluation() but may not exist
  // ---------------------------------------------------------------------------
  {
    name: "interview_evaluations: add model_version",
    sql: `ALTER TABLE interview_evaluations
            ADD COLUMN IF NOT EXISTS model_version VARCHAR(100) NULL DEFAULT NULL`,
  },

  // ---------------------------------------------------------------------------
  // FIX 7: skill_evaluations — level column used by
  //         Evaluation.saveSkillEvaluation() but may not exist
  // ---------------------------------------------------------------------------
  {
    name: "skill_evaluations: add level",
    sql: `ALTER TABLE skill_evaluations
            ADD COLUMN IF NOT EXISTS level VARCHAR(50) NULL DEFAULT NULL
            COMMENT 'BEGINNER | INTERMEDIATE | ADVANCED'`,
  },

  // ---------------------------------------------------------------------------
  // FIX 8: interview_videos — completed_at used by updateAfterUpload() and
  //         updateAfterMerge() but may not exist
  // ---------------------------------------------------------------------------
  {
    name: "interview_videos: add completed_at",
    sql: `ALTER TABLE interview_videos
            ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL DEFAULT NULL`,
  },
];

// =============================================================================
// VERIFY QUERIES — run after migration to confirm each table looks correct
// =============================================================================
const VERIFY_TABLES = [
  "interview_audio",
  "interview_violations",
  "interview_audio_chunks",
  "interview_questions",
  "interview_evaluations",
  "skill_evaluations",
  "interview_videos",
];

// =============================================================================
// HELPERS
// =============================================================================
function log(level, msg) {
  const icons = {
    info: "ℹ️ ",
    ok: "✅",
    warn: "⚠️ ",
    err: "❌",
    section: "━━",
  };
  const prefix = icons[level] || "  ";
  console.log(`${prefix} ${msg}`);
}

function section(title) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`   ${title}`);
  console.log(`${"=".repeat(70)}`);
}

// =============================================================================
// MAIN
// =============================================================================
async function runMigrations() {
  section("AI Voice Interview System — Database Migration");

  let connection;

  try {
    // -------------------------------------------------------------------------
    // 1. Connect
    // -------------------------------------------------------------------------
    log(
      "info",
      `Connecting to ${DB_CONFIG.host}:${DB_CONFIG.port} → database: "${DB_CONFIG.database}"`,
    );
    connection = await mysql.createConnection(DB_CONFIG);
    log("ok", "Connected successfully");

    // -------------------------------------------------------------------------
    // 2. Run each migration
    // -------------------------------------------------------------------------
    section("Running Migrations");

    const results = {
      passed: [],
      skipped: [],
      failed: [],
    };

    for (let i = 0; i < MIGRATIONS.length; i++) {
      const { name, sql } = MIGRATIONS[i];
      const label = `[${i + 1}/${MIGRATIONS.length}] ${name}`;

      try {
        await connection.execute(sql);
        log("ok", label);
        results.passed.push(name);
      } catch (err) {
        // MySQL error 1060 = column already exists (ER_DUP_FIELDNAME)
        // MySQL error 1061 = duplicate key name (index already exists)
        // MySQL error 1050 = table already exists (CREATE TABLE without IF NOT EXISTS)
        if ([1060, 1061, 1050].includes(err.errno)) {
          log(
            "warn",
            `${label} — already exists, skipped (errno ${err.errno})`,
          );
          results.skipped.push(name);
        } else {
          log("err", `${label} — FAILED: ${err.message}`);
          results.failed.push({ name, error: err.message, errno: err.errno });
          // Do not abort — attempt remaining migrations so we get a full picture
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. Verify — show columns for each affected table
    // -------------------------------------------------------------------------
    section("Verification — Column Check");

    for (const table of VERIFY_TABLES) {
      try {
        const [rows] = await connection.execute(
          `SHOW COLUMNS FROM \`${table}\``,
        );
        const cols = rows.map((r) => r.Field).join(", ");
        log("ok", `${table}: ${cols}`);
      } catch (err) {
        // Table may not exist if it was supposed to be created but failed
        log("err", `${table}: could not verify — ${err.message}`);
      }
    }

    // -------------------------------------------------------------------------
    // 4. Verify upload_status column width specifically — confirm the fix landed
    // -------------------------------------------------------------------------
    section("Verification — upload_status Column Detail");

    for (const table of ["interview_audio", "interview_audio_chunks"]) {
      try {
        const [rows] = await connection.execute(
          `SHOW COLUMNS FROM \`${table}\` WHERE Field = 'upload_status'`,
        );
        if (rows.length === 0) {
          log("warn", `${table}.upload_status — column not found`);
        } else {
          const col = rows[0];
          log(
            "ok",
            `${table}.upload_status — Type: ${col.Type}, Null: ${col.Null}, Default: '${col.Default}'`,
          );
        }
      } catch (err) {
        log("err", `${table}.upload_status — could not verify: ${err.message}`);
      }
    }

    // -------------------------------------------------------------------------
    // 5. Summary
    // -------------------------------------------------------------------------
    section("Migration Summary");
    log("ok", `Passed:  ${results.passed.length}`);
    log("warn", `Skipped: ${results.skipped.length} (already existed — safe)`);
    log(
      results.failed.length > 0 ? "err" : "ok",
      `Failed:  ${results.failed.length}`,
    );

    if (results.failed.length > 0) {
      console.log("\nFailed migrations:");
      for (const f of results.failed) {
        console.log(`  ❌ ${f.name}`);
        console.log(`     errno: ${f.errno} — ${f.error}`);
      }
      console.log("\n⚠️  Fix the errors above and re-run this script.");
      process.exit(1);
    } else {
      console.log("\n🎉 All migrations completed successfully.\n");
      process.exit(0);
    }
  } catch (err) {
    // Connection-level failure
    section("Fatal Error");
    log("err", `Could not connect to the database: ${err.message}`);
    console.log("\nCheck these .env variables:");
    console.log("  DB_HOST     =", process.env.DB_HOST || "(not set)");
    console.log(
      "  DB_PORT     =",
      process.env.DB_PORT || "(not set, default 3306)",
    );
    console.log("  DB_USER     =", process.env.DB_USER || "(not set)");
    console.log(
      "  DB_PASSWORD =",
      process.env.DB_PASSWORD ? "(set)" : "(not set)",
    );
    console.log("  DB_NAME     =", process.env.DB_NAME || "(not set)");
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      log("info", "DB connection closed");
    }
  }
}

runMigrations();
