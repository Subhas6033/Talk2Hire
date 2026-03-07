const express = require("express");
const { getUserReview } = require("../Review/sendReview.review.js");

const router = express.Router();

router.post("/send-user-review", getUserReview);

module.exports = router;
