const express = require("express");
const router = express.Router();
const {
  subscribeNewsletter,
  unsubscribeNewsletter,
  notifyJobToSubscribers,
} = require("../News/newsLetter.controllers.js");

const internalOnly = (req, res, next) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

router.post("/subscribe", subscribeNewsletter);
router.get("/unsubscribe", unsubscribeNewsletter);
router.post("/notify-job", internalOnly, notifyJobToSubscribers);

module.exports = router;
