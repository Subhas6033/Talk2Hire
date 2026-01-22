const app = require("./app.js");
const { connectDB, pool } = require("./Config/database.config.js");
const createAllTables = require("./Utils/db.utils.js");

const PORT = process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.get("/", (req, res) =>
      res.send(
        "Welcome to the Quantamhash Corporation AI Interview Platform Server"
      )
    );

    app.listen(PORT, async () => {
      try {
        await createAllTables(pool);
        console.log(`Server is running on port http://localhost:${PORT}`);
      } catch (error) {
        console.error("Error creating tables:", error);
        throw error;
      }
    });
  })
  .catch((err) => console.log("Error While connecting to DB:", err));
