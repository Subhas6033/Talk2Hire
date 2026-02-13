import { useState, useEffect, useRef } from "react";
import {
  InterviewQuestions,
  InterviewSettings,
  Modal,
  Button,
} from "../Components/index";

const Interview = () => {
  const [session, setSession] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  const cameraStreamRef = useRef(null);

  const handleInterviewReady = (data) => {
    console.log("✅ Interview session ready:", data);

    // Verify PRIMARY stream
    const videoTrack = data.cameraStream?.getVideoTracks()[0];
    if (!videoTrack) {
      console.error("❌ No primary video track!");
      alert("Primary camera stream invalid. Please refresh and try again.");
      return;
    }

    if (videoTrack.readyState !== "live") {
      console.error("❌ Primary video track not live:", videoTrack.readyState);
      alert(
        `Primary camera is ${videoTrack.readyState}. Please refresh and try again.`,
      );
      return;
    }

    console.log("✅ Primary stream verified:", {
      active: data.cameraStream.active,
      trackState: videoTrack.readyState,
    });

    // Secondary camera is on the mobile device — no local stream to verify
    // useSecondaryCamera hook inside InterviewQuestions handles it via socket

    cameraStreamRef.current = data.cameraStream;
    setSession(data);
  };

  const handleCancelInterview = () => {
    console.log("🛑 Canceling interview");

    const primaryStream = session?.cameraStream || cameraStreamRef.current;
    if (primaryStream) {
      primaryStream.getTracks().forEach((track) => {
        console.log(`🛑 Stopping primary ${track.kind} track`);
        track.stop();
      });
    }

    cameraStreamRef.current = null;
    setSession(null);
  };

  const handleFinish = () => {
    console.log("✅ Interview finished");

    const primaryStream = session?.cameraStream || cameraStreamRef.current;
    if (primaryStream) {
      primaryStream.getTracks().forEach((track) => track.stop());
    }

    cameraStreamRef.current = null;
    setShowSubmissionModal(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const primaryStream = cameraStreamRef.current;
      if (primaryStream) {
        console.log("🧹 Cleaning up primary camera on unmount");
        primaryStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <section className="w-full px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold">
            Interview Preparation
          </h1>
          <p className="text-textMuted max-w-2xl mx-auto">
            Select your Skills and start your real-time AI interview.
          </p>
        </div>

        {!session && !showSubmissionModal && (
          <InterviewSettings onInterviewReady={handleInterviewReady} />
        )}

        {session && !showSubmissionModal && (
          <InterviewQuestions
            interviewId={session.interviewId}
            userId={session.userId}
            cameraStream={session.cameraStream}
            // secondaryCameraStream is null — mobile device handles it independently
            secondaryCameraStream={session.secondaryCameraStream}
            onCancel={handleCancelInterview}
            onFinish={handleFinish}
          />
        )}

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
