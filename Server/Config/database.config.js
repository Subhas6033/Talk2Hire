const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "quantamhash_ai_interview_platform",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const connectDB = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to the MySQL database successfully.");
    return connection;
  } catch (error) {
    console.error("Error connecting to the MySQL database:", error);
    process.exit(1);
  }
};

module.exports = { connectDB, pool };
