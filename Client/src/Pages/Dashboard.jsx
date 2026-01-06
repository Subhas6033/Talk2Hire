import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Card, CardHeader, CardBody } from "../Components/Common/Card";
import { Button, Modal } from "../Components/index";
import {
  fadeUp,
  fadeIn,
  staggerContainer,
  fadeUpItem,
} from "../Animations/CommonAnimation";
import { useNavigate } from "react-router-dom";
import { getSuggestionByScore } from "../lib/Suggestions";

const STORAGE_KEY = "ai_interview_session";

const InterviewDashboard = ({
  config: configProp,
  questions: questionsProp,
  answers: answersProp,
}) => {
  const navigate = useNavigate();

  const [config, setConfig] = useState(configProp || {});
  const [questions, setQuestions] = useState(questionsProp || []);
  const [answers, setAnswers] = useState(answersProp || {});

  /* Get the Data from the localstorage */
  useEffect(() => {
    if (configProp && questionsProp?.length) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const parsed = JSON.parse(stored);

    setConfig(parsed.config || {});
    setQuestions(parsed.questions || []);
    setAnswers(parsed.answers || {});
  }, []);

  /* If no data found */
  if (!questions.length) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-white mb-2">
          No Interview Data Found
        </h2>
        <p className="text-white/60 mb-6">
          Please complete an interview to view the summary.
        </p>
        <Button onClick={() => navigate("/")}>Start Interview</Button>
      </div>
    );
  }

  const handleDownloadReport = () => {
    const reportLines = [];
    reportLines.push("AI INTERVIEW REPORT");
    reportLines.push("====================");
    reportLines.push("");
    reportLines.push(`Sector     : ${config.sector || "-"}`);
    reportLines.push(`Role       : ${config.role || "-"}`);
    reportLines.push(`Experience : ${config.experience || "-"}`);
    reportLines.push(`Difficulty : ${config.difficulty || "-"}`);
    reportLines.push(`Questions  : ${questions.length}`);
    reportLines.push("");
    reportLines.push("--------------------------------------------------");
    reportLines.push("");

    questions.forEach((q, index) => {
      reportLines.push(`Q${index + 1}: ${q}`);
      reportLines.push(`Answer: ${answers[index]?.text?.trim() || "Skipped"}`);
      reportLines.push(`Score : ${answers[index]?.score ?? 0} / 5`);
      reportLines.push("");
    });

    const blob = new Blob([reportLines.join("\n")], {
      type: "text/plain",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "AI_Interview_Report.txt";
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalScore = Object.values(answers).reduce(
    (sum, a) => sum + (a?.score || 0),
    0
  );

  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      className="max-w-7xl mx-auto px-6 py-16"
    >
      <motion.div
        variants={fadeIn}
        className="mb-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Interview Summary
          </h1>
          <p className="text-white/60">Review your performance and responses</p>
        </div>

        {/* Top Right Actions */}
        <div className="flex gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            Go to Home
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/interview")}
          >
            Retry
          </Button>

          <Button variant="primary" size="sm" onClick={handleDownloadReport}>
            Download Report
          </Button>
        </div>
      </motion.div>

      {/* Statistics */}
      <motion.div
        variants={staggerContainer(0.12)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-12"
      >
        {[
          { label: "Sector", value: config.sector || "—" },
          { label: "Role", value: config.role || "—" },
          { label: "Difficulty", value: config.difficulty || "—" },
          { label: "Questions", value: questions.length },
          { label: "Total Score", value: totalScore / (questions.length * 5) },
        ].map((item, i) => (
          <motion.div key={i} variants={fadeUpItem}>
            <Card variant="glow" hoverable>
              <CardHeader>{item.label}</CardHeader>
              <CardBody>
                <span className="text-xl font-semibold text-white">
                  {item.value}
                </span>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={staggerContainer(0.15)}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        <h2 className="text-xl font-semibold text-purpleSoft mb-4">
          Question Review
        </h2>

        {questions.map((q, index) => (
          <motion.div key={index} variants={fadeUpItem}>
            <Card className="w-full">
              <CardHeader>Question {index + 1}</CardHeader>
              <CardBody>
                <p className="mb-3 text-white">{q}</p>
                <div className="bg-black/30 rounded-xl p-4 text-white/70">
                  {answers[index]?.text?.trim() || "Skipped"}
                </div>

                <div className="mt-2 flex flex-wrap gap-4 items-center">
                  <span className="text-xs text-purpleGlow">
                    Score: {answers[index]?.score ?? 0} / 5
                  </span>

                  <span className="text-xs text-white/50">
                    Suggestion:{" "}
                    <span className="text-white/70">
                      {getSuggestionByScore(answers[index]?.score ?? 0)}
                    </span>
                  </span>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default InterviewDashboard;
