const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./Routes/auth.routes.js");
const fileUploadRoutes = require("./Middlewares/multer.middlewares.js");

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
app.use("/api/v1/file", fileUploadRoutes);

module.exports = app;
