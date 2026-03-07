const {
  asyncHandler,
  APIERR,
  APIRES,
  sendMail,
} = require("../Utils/index.utils.js");
const { Review } = require("../Models/userReview.models.js");

const sendInterviewReview = asyncHandler(async (req, res) => {});

const getUserReview = asyncHandler(async (req, res) => {
  const { fullName, email, subject, message } = req.body;

  if ([fullName, email, subject, message].some((e) => !e || e.trim() === "")) {
    throw new APIERR(400, "All fields are required");
  }

  // Save review to DB
  const review = await Review.saveReview({
    fullName: fullName.trim(),
    email: email.trim(),
    subject: subject.trim(),
    message: message.trim(),
  });

  if (!review) {
    throw new APIERR(500, "Failed to submit review");
  }

  // Send welcome/thank-you email
  await sendMail(
    email.trim(),
    "Thanks for your review!",
    `Hi ${fullName}, we received your review and will get back to you soon.`,
    `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${fullName}, thank you for reaching out! 🎉</h2>
        <p>We've received your message and really appreciate you taking the time
           to share your thoughts.</p>
        <hr />
        <p><strong>Your submission:</strong></p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong> ${message}</p>
        <hr />
        <p>We'll get back to you at <strong>${email}</strong> as soon as possible.</p>
        <p>Best regards,<br/>The Talk2Hire Team</p>
      </div>
    `,
  );

  return res
    .status(201)
    .json(new APIRES(201, review, "Review submitted successfully"));
});

module.exports = { sendInterviewReview, getUserReview };
