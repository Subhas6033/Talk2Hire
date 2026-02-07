const http = require("http");
const app = require("./app.js");
const { connectDB, pool } = require("./Config/database.config.js");
const createAllTables = require("./Utils/db.utils.js");
const {
  initInterviewSocket,
} = require("./Controllers/interviewSocket.controller.js");

const PORT = process.env.PORT;

// Create HTTP server
const server = http.createServer(app);

connectDB()
  .then(async () => {
    app.get("/", (req, res) => {
      res.send(
        "Welcome to the Quantamhash Corporation AI Interview Platform Server",
      );
    });

    // Initialize Socket.IO
    initInterviewSocket(server);

    // Start server
    server.listen(PORT, async () => {
      try {
        await createAllTables(pool);
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`🔌 Socket.IO ready`);
      } catch (error) {
        console.error("❌ Error creating tables:", error);
        throw error;
      }
    });
  })
  .catch((err) => {
    console.error("❌ Error while connecting to DB:", err);
    process.exit(1);
  });
