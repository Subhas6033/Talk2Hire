const { ollama } = require("../Config/openai.config.js");
const { pool } = require("../Config/database.config.js");
const { Interview } = require("../Models/interview.models.js");
const { Evaluation } = require("../Models/answer.models.js");
const { APIERR } = require("../Utils/index.utils.js");

/**
 * Evaluate a single question-answer pair
 */
async function evaluateSingleAnswer({ question, answer, technology }) {
  try {
    const prompt = `
You are an expert technical interviewer evaluating a candidate's answer.

Question: "${question}"
Answer: "${answer}"
Technology: ${technology || "General"}

Evaluate this answer and return ONLY a JSON object with this exact structure:
{
  "score": <number 0-10>,
  "correctness": <number 0-10>,
  "depth": <number 0-10>,
  "clarity": <number 0-10>,
  "feedback": "<specific feedback on what was good and what could be improved>",
  "detected_level": "<BEGINNER|INTERMEDIATE|ADVANCED>"
}

Scoring guidelines:
- score: Overall quality (0-10)
- correctness: Technical accuracy (0-10)
- depth: Level of detail and understanding (0-10)
- clarity: How well-structured and clear the answer is (0-10)
- detected_level: Based on the depth and correctness of the answer

Be strict but fair. Look for:
- Technical accuracy
- Practical experience indicators
- Clear understanding of concepts
- Real-world application knowledge
`;

    const response = await ollama.chat({
      model: "deepseek-v3.1:671b-cloud",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a senior technical interviewer with 10+ years of experience.",
        },
        { role: "user", content: prompt },
      ],
    });

    const raw = response?.choices?.[0]?.message?.content;
    if (!raw) {
      throw new Error("AI returned empty response");
    }

    // Parse the JSON response
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    // Validate the response
    if (
      typeof parsed.score !== "number" ||
      typeof parsed.correctness !== "number" ||
      typeof parsed.depth !== "number" ||
      typeof parsed.clarity !== "number" ||
      !parsed.feedback ||
      !parsed.detected_level
    ) {
      throw new Error("Invalid evaluation response format");
    }

    return parsed;
  } catch (error) {
    console.error("❌ Error evaluating single answer:", error);
    throw error;
  }
}

/**
 * Evaluate all answers for an interview
 */
async function evaluateInterview(interviewId) {
  try {
    console.log(`🔍 Starting evaluation for interview ${interviewId}`);

    // Get all questions and answers
    const history = await Interview.getSessionHistory(interviewId);

    if (!history || history.length === 0) {
      throw new APIERR(404, "No questions found for this interview");
    }

    // Filter only answered questions
    const answeredQuestions = history.filter(
      (q) => q.answer && q.answer.trim() !== "",
    );

    if (answeredQuestions.length === 0) {
      throw new APIERR(400, "No answered questions to evaluate");
    }

    console.log(
      `📊 Evaluating ${answeredQuestions.length} answered questions...`,
    );

    // Evaluate each question-answer pair
    const evaluations = [];
    for (const question of answeredQuestions) {
      console.log(`📝 Evaluating question ${question.question_order}...`);

      const evaluation = await evaluateSingleAnswer({
        question: question.question,
        answer: question.answer,
        technology: question.technology,
      });

      // Save question evaluation
      await Evaluation.saveQuestionEvaluation({
        interviewId,
        questionId: question.id,
        score: evaluation.score,
        correctness: evaluation.correctness,
        depth: evaluation.depth,
        clarity: evaluation.clarity,
        feedback: evaluation.feedback,
        level: evaluation.detected_level,
      });

      evaluations.push({
        questionId: question.id,
        questionOrder: question.question_order,
        technology: question.technology,
        ...evaluation,
      });

      console.log(
        ` Question ${question.question_order} evaluated: ${evaluation.score}/10`,
      );
    }

    // Generate overall evaluation
    const overallEvaluation = await generateOverallEvaluation(
      interviewId,
      evaluations,
      answeredQuestions,
    );

    console.log(
      ` Interview evaluation complete. Overall score: ${overallEvaluation.overallScore}/100`,
    );

    return {
      questionEvaluations: evaluations,
      overallEvaluation,
      totalQuestions: answeredQuestions.length,
    };
  } catch (error) {
    console.error("❌ Error evaluating interview:", error);
    throw error;
  }
}

/**
 * Generate overall interview evaluation
 */
async function generateOverallEvaluation(interviewId, evaluations, questions) {
  try {
    // Calculate average scores
    const avgScore =
      evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length;
    const avgCorrectness =
      evaluations.reduce((sum, e) => sum + e.correctness, 0) /
      evaluations.length;
    const avgDepth =
      evaluations.reduce((sum, e) => sum + e.depth, 0) / evaluations.length;
    const avgClarity =
      evaluations.reduce((sum, e) => sum + e.clarity, 0) / evaluations.length;

    // Determine experience level based on average depth and correctness
    let experienceLevel = "BEGINNER";
    if (avgDepth >= 7 && avgCorrectness >= 7) {
      experienceLevel = "ADVANCED";
    } else if (avgDepth >= 5 && avgCorrectness >= 5) {
      experienceLevel = "INTERMEDIATE";
    }

    // Count levels
    const levelCounts = evaluations.reduce((acc, e) => {
      acc[e.detected_level] = (acc[e.detected_level] || 0) + 1;
      return acc;
    }, {});

    // Calculate overall score (0-100)
    const overallScore = Math.round(avgScore * 10);

    // Determine hire decision
    let hireDecision = "NO";
    if (overallScore >= 75) {
      hireDecision = "YES";
    } else if (overallScore >= 60) {
      hireDecision = "MAYBE";
    }

    // Generate AI summary
    const summary = await generateInterviewSummary({
      evaluations,
      questions,
      avgScore,
      avgCorrectness,
      avgDepth,
      avgClarity,
      experienceLevel,
    });

    // Save overall evaluation
    await Evaluation.saveInterviewEvaluation({
      interviewId,
      overallScore,
      hireDecision,
      experienceLevel,
      strengths: summary.strengths,
      weaknesses: summary.weaknesses,
      summary: summary.summary,
      modelVersion: "deepseek-v3.1:671b-cloud",
    });

    // Save skill evaluations by technology
    const skillGroups = evaluations.reduce((acc, e) => {
      if (e.technology) {
        if (!acc[e.technology]) {
          acc[e.technology] = [];
        }
        acc[e.technology].push(e);
      }
      return acc;
    }, {});

    for (const [technology, techEvaluations] of Object.entries(skillGroups)) {
      const techAvgScore =
        techEvaluations.reduce((sum, e) => sum + e.score, 0) /
        techEvaluations.length;

      let techLevel = "BEGINNER";
      if (techAvgScore >= 7.5) {
        techLevel = "ADVANCED";
      } else if (techAvgScore >= 5) {
        techLevel = "INTERMEDIATE";
      }

      await Evaluation.saveSkillEvaluation({
        interviewId,
        technology,
        score: techAvgScore,
        level: techLevel,
      });
    }

    return {
      overallScore,
      hireDecision,
      experienceLevel,
      averages: {
        score: avgScore,
        correctness: avgCorrectness,
        depth: avgDepth,
        clarity: avgClarity,
      },
      levelDistribution: levelCounts,
      strengths: summary.strengths,
      weaknesses: summary.weaknesses,
      summary: summary.summary,
    };
  } catch (error) {
    console.error("❌ Error generating overall evaluation:", error);
    throw error;
  }
}

/**
 * Generate AI-powered summary of the interview
 */
async function generateInterviewSummary({
  evaluations,
  questions,
  avgScore,
  avgCorrectness,
  avgDepth,
  avgClarity,
  experienceLevel,
}) {
  try {
    // Prepare evaluation data for AI
    const evaluationSummary = evaluations
      .map((e, i) => {
        const q = questions.find((q) => q.id === e.questionId);
        return `
Q${e.questionOrder}: ${q.question.substring(0, 100)}...
A: ${q.answer.substring(0, 150)}...
Score: ${e.score}/10 | Correctness: ${e.correctness}/10 | Depth: ${e.depth}/10 | Clarity: ${e.clarity}/10
Feedback: ${e.feedback}
---`;
      })
      .join("\n");

    const prompt = `
You are a senior technical hiring manager reviewing an interview evaluation.

Overall Statistics:
- Average Score: ${avgScore.toFixed(2)}/10
- Average Correctness: ${avgCorrectness.toFixed(2)}/10
- Average Depth: ${avgDepth.toFixed(2)}/10
- Average Clarity: ${avgClarity.toFixed(2)}/10
- Detected Experience Level: ${experienceLevel}
- Total Questions Answered: ${evaluations.length}

Question Evaluations:
${evaluationSummary}

Based on this interview evaluation, provide:
1. Top 3-5 key STRENGTHS (be specific, mention technologies/concepts where they excelled)
2. Top 3-5 key WEAKNESSES or areas for improvement
3. An overall SUMMARY (2-3 paragraphs) of the candidate's performance

Return ONLY a JSON object:
{
  "strengths": "<bullet-pointed list of strengths>",
  "weaknesses": "<bullet-pointed list of weaknesses>",
  "summary": "<comprehensive summary paragraph>"
}
`;

    const response = await ollama.chat({
      model: "deepseek-v3.1:671b-cloud",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a senior hiring manager providing constructive feedback.",
        },
        { role: "user", content: prompt },
      ],
    });

    const raw = response?.choices?.[0]?.message?.content;
    if (!raw) {
      throw new Error("AI returned empty response for summary");
    }

    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    return {
      strengths: parsed.strengths || "No specific strengths identified",
      weaknesses: parsed.weaknesses || "No specific weaknesses identified",
      summary: parsed.summary || "No summary available",
    };
  } catch (error) {
    console.error("❌ Error generating interview summary:", error);

    // Return fallback summary
    return {
      strengths: `Average performance across ${evaluations.length} questions`,
      weaknesses: "Unable to generate detailed analysis",
      summary: `Candidate completed ${evaluations.length} questions with an average score of ${avgScore.toFixed(2)}/10.`,
    };
  }
}

/**
 * Get complete evaluation results for an interview
 */
async function getEvaluationResults(interviewId) {
  try {
    const db = pool;

    // Get interview evaluation
    const [interviewEval] = await db.execute(
      `SELECT * FROM interview_evaluations WHERE interview_id = ?`,
      [interviewId],
    );

    // Get question evaluations
    const [questionEvals] = await db.execute(
      `SELECT qe.*, iq.question, iq.answer, iq.question_order, iq.technology
       FROM question_evaluations qe
       JOIN interview_questions iq ON qe.question_id = iq.id
       WHERE qe.interview_id = ?
       ORDER BY iq.question_order ASC`,
      [interviewId],
    );

    // Get skill evaluations
    const [skillEvals] = await db.execute(
      `SELECT * FROM skill_evaluations WHERE interview_id = ? ORDER BY average_score DESC`,
      [interviewId],
    );

    return {
      interviewEvaluation: interviewEval[0] || null,
      questionEvaluations: questionEvals || [],
      skillEvaluations: skillEvals || [],
    };
  } catch (error) {
    console.error("❌ Error getting evaluation results:", error);
    throw error;
  }
}

module.exports = {
  evaluateSingleAnswer,
  evaluateInterview,
  generateOverallEvaluation,
  getEvaluationResults,
};
