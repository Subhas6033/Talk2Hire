export const getSuggestionByScore = (score) => {
  if (score === 5)
    return "Excellent answer. Strong clarity and technical depth.";
  if (score === 4)
    return "Good answer. Minor improvements in depth or examples.";
  if (score === 3)
    return "Decent attempt. Try adding more structure and clarity.";
  if (score === 2) return "Answer needs better relevance and correctness.";
  if (score === 1)
    return "Attempt made, but focus on understanding core concepts.";
  return "No answer provided. Try to attempt every question.";
};
