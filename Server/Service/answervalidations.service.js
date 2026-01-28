const { APIERR } = require("../Utils/index.utils.js");

function validateAnswer(answer) {
  if (!answer || typeof answer !== "string") {
    throw new APIERR(400, "Answer is required and must be a string");
  }

  const trimmed = answer.trim();

  if (trimmed.length < 8) {
    return {
      status: "invalid",
      score: 0,
      reason: "Answer is too short",
    };
  }

  const wordCount = trimmed.split(/\s+/).length;

  if (wordCount < 5) {
    return {
      status: "weak",
      score: 40,
      reason: "Answer lacks sufficient explanation",
    };
  }

  if (wordCount < 12) {
    return {
      status: "average",
      score: 65,
      reason: "Answer is acceptable but could be more detailed",
    };
  }

  return {
    status: "strong",
    score: 90,
    reason: "Well explained and structured answer",
  };
}

module.exports = { validateAnswer };
