const { pool } = require("./Config/database.config.js");

const MIGRATIONS = [
  {
    table: "admins",
    sql: `
      CREATE TABLE IF NOT EXISTS admins (
        id                  INT UNSIGNED        NOT NULL AUTO_INCREMENT,

        fullName           VARCHAR(100)        NOT NULL,
        email               VARCHAR(255)        NOT NULL,
        username            VARCHAR(50)         NOT NULL,

        hashPassword        VARCHAR(255)                 NULL
          COMMENT 'Bcrypt hash; NULL when SSO-only account',
        microsoft_id        VARCHAR(255)                 NULL
          COMMENT 'Microsoft OAuth subject ID for SSO login',

        role                ENUM(
                              'super_admin',
                              'admin',
                              'moderator',
                              'support'
                            )                   NOT NULL DEFAULT 'admin',
        permissions         JSON                         NULL
          COMMENT 'Fine-grained permission flags, e.g. {"canDeleteUsers":true}',

        status              ENUM(
                              'active',
                              'inactive',
                              'suspended'
                            )                   NOT NULL DEFAULT 'active',
        is_email_verified   TINYINT(1)          NOT NULL DEFAULT 0,
        failed_login_count  TINYINT UNSIGNED    NOT NULL DEFAULT 0,
        locked_until        DATETIME                     NULL
          COMMENT 'Account locked until this timestamp after repeated failures',

        reset_token         VARCHAR(255)                 NULL,
        reset_token_expiry  DATETIME                     NULL,

        refresh_token       TEXT                         NULL,
        last_login_at       DATETIME                     NULL,
        last_login_ip       VARCHAR(45)                  NULL
          COMMENT 'Supports IPv4 and IPv6',

        created_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                         ON UPDATE CURRENT_TIMESTAMP,
        deleted_at          DATETIME                     NULL
          COMMENT 'Soft-delete timestamp; NULL means record is active',

        PRIMARY KEY (id),
        UNIQUE KEY uq_admins_email      (email),
        UNIQUE KEY uq_admins_username   (username),
        UNIQUE KEY uq_admins_ms_id      (microsoft_id),

        INDEX idx_admins_role           (role),
        INDEX idx_admins_status         (status),
        INDEX idx_admins_deleted_at     (deleted_at)

      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
        COMMENT='Talk2Hire platform administrators';
    `,
  },
];

async function inspectTable(connection, tableName) {
  const [exists] = await connection.query(`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}';
  `);
  if (exists.length === 0) {
    console.log(`❌ '${tableName}' does NOT exist`);
    return false;
  }

  const [cols] = await connection.query(`
    SELECT ORDINAL_POSITION AS \`#\`, COLUMN_NAME AS \`Column\`,
           COLUMN_TYPE AS \`Type\`, IS_NULLABLE AS \`Nullable\`,
           COLUMN_DEFAULT AS \`Default\`, COLUMN_KEY AS \`Key\`,
           COLUMN_COMMENT AS \`Comment\`
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}'
    ORDER BY ORDINAL_POSITION;
  `);
  console.log(`\n📋 '${tableName}' — ${cols.length} columns:\n`);
  console.table(cols);
  return true;
}

const migrate = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("✅ Connected to database\n");

    console.log("🔧 Running migrations…\n");
    for (const { table, sql } of MIGRATIONS) {
      try {
        await connection.query(sql);
        console.log(`✅ '${table}' — migration ready`);
      } catch (err) {
        console.error(`❌ '${table}' migration failed: ${err.message}`);
      }
    }
    console.log();

    console.log("🔍 Verifying columns…\n");
    await inspectTable(connection, "admins");
  } catch (err) {
    console.error("❌ Script failed:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

migrate();
