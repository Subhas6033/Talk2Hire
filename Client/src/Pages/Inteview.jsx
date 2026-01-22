import React, { useState, useRef, useEffect } from "react";
import { Card } from "../Components/Common/Card";
import { Button, Guidlines } from "../Components";
import Modal from "../Components/Common/Modal";
import { ArrowRight, Mic, LayoutDashboard, Timer } from "lucide-react";
import {
  Questions,
  jobRoles,
  jobSectors,
  experienceLevels,
  difficultyLevels,
} from "../Data/InterviewQuestions";
import { useNavigate } from "react-router-dom";
import ResumeUpload from "../Components/Others/UploadFile";
import { scoreAnswer } from "../lib/CheckScore";

const STORAGE_KEY = "ai_interview_session";

const ConfigureInterview = ({ onStart }) => {
  const recognitionRef = useRef(null);
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [sector, setSector] = useState("");
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const [openQuestions, setOpenQuestions] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [answers, setAnswers] = useState({});
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  const [interviewConfig, setInterviewConfig] = useState(null);

  const TOTAL_TIME = 5 * 60;
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  // Countdown for the interview
  useEffect(() => {
    if (!openQuestions) return;

    setTimeLeft(TOTAL_TIME);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const updatedTime = prev - 1;

        // persist time
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (stored) {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...stored, timeLeft: updatedTime })
          );
        }

        if (updatedTime <= 0) {
          clearInterval(timer);
          setOpenQuestions(false);
          setIsDashboardOpen(true);
          return 0;
        }

        return updatedTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [openQuestions]);

  // Formate the time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const loadQuestions = () => {
    const selected = Questions?.[sector]?.[difficulty] || [];
    setQuestions(selected);
    setCurrentIndex(0);
    setAnswers({});
  };

  // Handel Speech Recording
  const startRecording = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setAnswerText(transcript);
    };

    recognition.onerror = (e) => {
      console.error("Speech error:", e.error);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const handleNextQuestion = () => {
    const score = scoreAnswer(answerText, questions[currentIndex]);
    const updatedAnswers = {
      ...answers,
      [currentIndex]: {
        text: "",
        score: 0,
      },
    };

    setAnswers(updatedAnswers);
    stopRecording();

    // persist answers
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...stored, answers: updatedAnswers })
      );
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setOpenQuestions(false);
      setIsDashboardOpen(true);
    }
  };

  const handleSkipQuestion = () => {
    stopRecording();
    setAnswerText("");
    handleNextQuestion();
  };

  const handleStart = () => {
    if (!resume || !sector || !role || !experience || !difficulty) {
      alert("Please fill all fields and upload your resume.");
      return;
    }
    navigate("/guidlines");
  };

  const speakQuestion = (text) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (openQuestions && questions.length > 0) {
      speakQuestion(questions[currentIndex]);
    }
  }, [currentIndex, openQuestions]);

  return (
    <>
      <title>QuantamHash Corporation | Interview</title>
      {/* Interview setup UI*/}
      <div className="w-full max-w-7xl mx-auto py-16 px-6">
        <Card variant="glow" padding="lg" className="border-transparent">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Configure Your Interview
          </h2>
          <p className="text-white/60 text-sm mb-6 text-center">
            Upload your resume and select your preferences to begin
          </p>

          {/* Resume Upload */}
          <ResumeUpload resume={resume} onFileSelect={setResume} />
          {/* Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
            {[
              ["Job Sector", sector, setSector, jobSectors],
              ["Job Role", role, setRole, jobRoles],
              ["Experience Level", experience, setExperience, experienceLevels],
              ["Difficulty Level", difficulty, setDifficulty, difficultyLevels],
            ].map(([label, value, setter, options], i) => (
              <div key={i}>
                <label className="block text-xs text-white/60 mb-1">
                  {label}
                </label>
                <select
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full rounded-xl bg-white/5 px-4 py-3 text-white/75 focus:outline-none focus:ring-2 focus:ring-purpleGlow/40"
                >
                  <option value="" className="text-slate-900">
                    Select {label.toLowerCase()}
                  </option>
                  {options.map((opt, idx) => (
                    <option key={idx} value={opt} className="text-slate-900">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={handleStart}
          >
            Start Interview <ArrowRight className="ml-2" />
          </Button>
        </Card>
      </div>

      {/* Questions */}
      <Modal
        isOpen={openQuestions}
        onClose={() => setOpenQuestions(false)}
        title="AI Interview"
        size="md"
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#3e445e] flex items-center justify-center text-white font-semibold">
                AI
              </div>
              <div>
                <p className="text-white font-medium">AI Interviewer</p>
                <p className="text-white/60 text-sm">
                  Question {currentIndex + 1} of {questions.length}
                </p>
              </div>
            </div>

            <div className="bg-[#1b1f2a] px-4 py-2 rounded-xl text-white font-semibold flex justify-center gap-3">
              <Timer /> {formatTime(timeLeft)}
            </div>
          </div>

          {/* Question */}
          <div className="bg-[#1b1f2a] rounded-xl p-4 text-white">
            {questions[currentIndex]}
          </div>

          {/* Answer */}
          <div className="bg-[#1b1f2a] rounded-xl p-4 text-white min-h-25">
            {answerText || (
              <span className="text-white/60">
                Your response will appear here as you speak...
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center px-4 py-2 rounded-xl font-semibold transition ${
                  isRecording
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-blue-600 hover:bg-blue-500"
                } text-white`}
              >
                <Mic className="w-5 h-5 mr-2" />
                {isRecording ? "Stop Recording" : "Start Recording"}
              </button>

              <button
                onClick={handleSkipQuestion}
                className="px-4 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition"
              >
                Skip
              </button>
            </div>

            <button
              onClick={handleNextQuestion}
              className="text-white/70 hover:text-white transition font-medium"
            >
              {currentIndex === questions.length - 1
                ? "Finish Interview"
                : "Next Question →"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Show the Dashboard after finished the interview */}
      {isDashboardOpen && (
        <Modal
          isOpen={isDashboardOpen}
          onClose={() => setIsDashboardOpen(false)}
          title="Interview Summary"
          size="md"
        >
          <div className="flex gap-4">
            <Button className="flex-1" onClick={() => navigate("/dashboard")}>
              <LayoutDashboard className="mr-2" />
              Go to Dashboard
            </Button>

            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => window.location.reload()}
            >
              Start New Interview
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default ConfigureInterview;
