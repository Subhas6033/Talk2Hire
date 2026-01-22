export const scoreAnswer = (answer, question) => {
  if (!answer || answer.trim().length === 0) return 0;

  const length = answer.split(" ").length;

  // Basic confidence signals
  const confidenceWords = ["clearly", "confident", "definitely", "sure"];
  const hasConfidence = confidenceWords.some((word) =>
    answer.toLowerCase().includes(word)
  );

  // Keyword relevance (simple version)
  const keywords = question
    .toLowerCase()
    .split(" ")
    .filter((w) => w.length > 4);

  const keywordMatches = keywords.filter((k) =>
    answer.toLowerCase().includes(k)
  ).length;

  // Scoring logic
  if (length > 80 && keywordMatches >= 3 && hasConfidence) return 5;
  if (length > 60 && keywordMatches >= 2) return 4;
  if (length > 40 && keywordMatches >= 1) return 3;
  if (length > 20) return 2;
  return 1;
};
