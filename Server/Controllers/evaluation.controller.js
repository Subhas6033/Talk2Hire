const {
  evaluateInterview,
  getEvaluationResults,
} = require("../Service/evaluation.service.js");
const { APIERR, asyncHandler } = require("../Utils/index.utils.js");

const evaluateInterviewController = asyncHandler(async (req, res) => {
  const { interviewId } = req.params; //params

  if (!interviewId) {
    throw new APIERR(400, "Interview ID is required");
  }

  console.log(`🎯 Starting evaluation for interview ${interviewId}`);

  try {
    const results = await evaluateInterview(interviewId);

    return res.status(200).json({
      success: true,
      message: "Interview evaluated successfully",
      data: results,
    });
  } catch (error) {
    console.error("❌ Error in evaluateInterviewController:", error);
    throw error;
  }
});

const getEvaluationController = asyncHandler(async (req, res) => {
  const { interviewId } = req.params; //params

  if (!interviewId) {
    throw new APIERR(400, "Interview ID is required");
  }

  console.log(`📊 Fetching evaluation results for interview ${interviewId}`);

  try {
    const results = await getEvaluationResults(interviewId);

    if (!results.interviewEvaluation) {
      throw new APIERR(
        404,
        "Evaluation not found. Please evaluate the interview first."
      );
    }

    return res.status(200).json({
      success: true,
      message: "Evaluation results retrieved successfully",
      data: results,
    });
  } catch (error) {
    console.error("❌ Error in getEvaluationController:", error);
    throw error;
  }
});

const getEvaluationSummary = asyncHandler(async (req, res) => {
  const { interviewId } = req.params; // params

  if (!interviewId) {
    throw new APIERR(400, "Interview ID is required");
  }

  try {
    const results = await getEvaluationResults(interviewId);

    if (!results.interviewEvaluation) {
      throw new APIERR(404, "Evaluation not found");
    }

    // Return only summary information
    const summary = {
      overallScore: results.interviewEvaluation.overall_score,
      hireDecision: results.interviewEvaluation.hire_decision,
      experienceLevel: results.interviewEvaluation.experience_level,
      summary: results.interviewEvaluation.summary,
      strengths: results.interviewEvaluation.strengths,
      weaknesses: results.interviewEvaluation.weaknesses,
      totalQuestions: results.questionEvaluations.length,
      evaluatedAt: results.interviewEvaluation.created_at,
    };
    console.log(summary);
    return res.status(200).json({
      success: true,
      message: "Evaluation summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    console.error("❌ Error in getEvaluationSummary:", error);
    throw error;
  }
});

module.exports = {
  evaluateInterviewController,
  getEvaluationController,
  getEvaluationSummary,
};
