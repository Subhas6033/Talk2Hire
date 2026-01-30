const {
  asyncHandler,
  APIERR,
  APIRES,
  sendMail,
} = require("../Utils/index.utils.js");

// Sends the report of the Interview after some time when the computation is done by the AI
const sendInterviewReview = asyncHandler(async (req, res) => {});

module.exports = { sendInterviewReview };
