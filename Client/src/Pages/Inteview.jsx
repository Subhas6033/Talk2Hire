import { useState } from "react";
import {
  InterviewQuestions,
  InterviewSettings,
  Modal,
  Button,
} from "../Components/index";

const Interview = () => {
  const [session, setSession] = useState(null); // { interviewId, userId }
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  const handleInterviewReady = (data) => {
    console.log("Interview session ready:", data);
    setSession(data);
  };

  const handleCancelInterview = () => {
    setSession(null);
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
            Upload your resume and start your real-time AI interview.
          </p>
        </div>

        {/* Settings */}
        {!session && !showSubmissionModal && (
          <InterviewSettings onInterviewReady={handleInterviewReady} />
        )}

        {/* Interview */}
        {session && !showSubmissionModal && (
          <InterviewQuestions
            interviewId={session.interviewId}
            userId={session.userId}
            onCancel={handleCancelInterview}
            onFinish={() => setShowSubmissionModal(true)}
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
