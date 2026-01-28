const userTableQuery = `
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fullName VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashPassword VARCHAR(255) NOT NULL,
    refreshToken TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
`;

const interviewTableQuery = `
CREATE TABLE IF NOT EXISTS interviews (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
);
`;

const interviewQuestionsTableQuery = `
CREATE TABLE IF NOT EXISTS interview_questions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    interview_id INT UNSIGNED NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    technology VARCHAR(255),
    difficulty VARCHAR(50),
    question_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (interview_id)
      REFERENCES interviews(id)
      ON DELETE CASCADE
);
`;

const createTable = async (pool, tableName, query) => {
  try {
    await pool.query(query);
    console.log(`Table ${tableName} created or already exists.`);
  } catch (error) {
    console.error(`Error creating table ${tableName}:`, error);
    throw error;
  }
};

const createAllTables = async (pool) => {
  try {
    await createTable(pool, "users", userTableQuery);
    await createTable(pool, "users", interviewTableQuery);
    await createTable(pool, "users", interviewQuestionsTableQuery);
    console.log("All tables created successfully.");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  }
};

module.exports = createAllTables;
