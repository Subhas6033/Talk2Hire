exports.shouldEndInterview = async (interviewId) => {
  const stats = await Interview.getStats(interviewId);

  if (stats.totalQuestions >= 10) return true;
  if (stats.weakAnswers >= 4) return true;

  return false;
};
