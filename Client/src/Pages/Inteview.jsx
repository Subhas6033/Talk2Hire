import { useState } from "react";
import {
  InterviewQuestions,
  InterviewSettings,
  Modal,
  Button,
} from "../Components/index";

const Interview = () => {
  const [showInterview, setShowInterview] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [duration, setDuration] = useState(300);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  const FALLBACK_QUESTIONS = [
    "Tell me about yourself.",
    "What are your strongest technical skills?",
    "Describe a challenging problem you solved recently.",
    "How do you handle tight deadlines?",
    "Why do you want this role?",
  ];

  // Called when interview settings are ready
  const handleInterviewReady = () => {
    setQuestions(FALLBACK_QUESTIONS);
    setDuration(300);
    setCurrentQuestionIndex(0);
    setShowInterview(true);
  };

  const handleCancelInterview = () => {
    setShowInterview(false);
    setQuestions([]);
    setCurrentQuestionIndex(0);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Last question submitted
      setShowInterview(false); // Exit full-screen
      setShowSubmissionModal(true); // Show submission modal
    }
  };

  return (
    <section className="w-full px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold">
            Interview Preparation
          </h1>
          <p className="text-textMuted max-w-2xl mx-auto">
            Upload your resume and configure your interview preferences.
          </p>
        </div>

        {/* Settings Page */}
        {!showInterview && !showSubmissionModal && (
          <InterviewSettings onInterviewReady={handleInterviewReady} />
        )}

        {/* Fullscreen Interview Questions */}
        {showInterview && (
          <InterviewQuestions
            isOpen={showInterview}
            question={questions[currentQuestionIndex]}
            duration={duration}
            isLastQuestion={currentQuestionIndex === questions.length - 1}
            onCancel={handleCancelInterview}
            onNext={handleNextQuestion}
          />
        )}

        {/* Submission Modal */}
        <Modal
          isOpen={showSubmissionModal}
          onClose={() => setShowSubmissionModal(false)}
          title="Interview Submitted"
          size="md"
        >
          <p className="text-center text-white/80">
            You have successfully submitted your interview.
          </p>

          <div className="mt-6 flex justify-center gap-4">
            <Button
              onClick={() => {
                setShowSubmissionModal(false);
                // navigate to home
                window.location.href = "/";
              }}
            >
              Go to Home
            </Button>

            <Button
              onClick={() => {
                setShowSubmissionModal(false);
                window.location.href = "/dashboard";
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        </Modal>
      </div>
    </section>
  );
};

export default Interview;
