const APIERR = require("./apierr.utils.js");
const APIRES = require("./apires.utils.js");
const asyncHandler = require("./asynchandler.utils.js");
const sendMail = require("./mail/sendMail.utils.js");
const {
  buildCompanyWelcomeEmail,
  buildUserWelcomeEmail,
} = require("./mail/Welcomemail.utils.js");

module.exports = {
  APIERR,
  APIRES,
  asyncHandler,
  sendMail,
  buildCompanyWelcomeEmail,
  buildUserWelcomeEmail,
};
