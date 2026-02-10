const mysql = require("mysql2/promise");
require("dotenv").config();

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 100, // Maximum number of connections
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Test the pool on startup
pool
  .getConnection()
  .then((connection) => {
    console.log("✅ Database pool created successfully");
    connection.release();
  })
  .catch((error) => {
    console.error("❌ Database pool creation failed:", error);
  });

// Export function to get connection from pool
const connectDB = async () => pool;

module.exports = { connectDB, pool };
