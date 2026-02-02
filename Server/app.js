const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./Routes/auth.routes.js");
const questionRoutes = require("./Middlewares/multer.middlewares.js");
const speechRoutes = require("./Middlewares/multer.middlewares.js");
const resultRouter = require("./Routes/result.routes.js");

const app = express();
dotenv.config();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    limit: "10mb",
    extended: true,
  })
);

app.use(cookieParser());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/questions", questionRoutes);
app.use("/api/v1/speech", speechRoutes);
app.use("/api/v1/result", resultRouter);

module.exports = app;
