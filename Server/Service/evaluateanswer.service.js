const { openai } = require("../Config/openai.config");

exports.evaluateAnswer = async (answer) => {
  const prompt = `
Evaluate this interview answer:

"${answer}"

Return JSON:
{
  "quality": "strong | weak | irrelevant",
  "confidence": 0-100
}
`;

  const res = await ollama.chat({
    model: "deepseek-v3.1:671b-cloud",
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });

  return JSON.parse(res.choices[0].message.content);
};
