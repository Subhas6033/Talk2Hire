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
    console.log("All tables created successfully.");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  }
};

module.exports = createAllTables;
