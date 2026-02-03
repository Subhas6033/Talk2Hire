const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: false, // 587
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendMail = async (to, subject, text, html) => {
  // Email details
  const mailOptions = {
    from: process.env.MAIL_FROM,
    to: to,
    subject: subject,
    text: text,
    html: html,
  };

  // Send email
  const result = await transporter.sendMail(mailOptions);
  return result;
};

module.exports = sendMail;
