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

  // ✅ Track stream in ref to prevent loss during re-renders
  const cameraStreamRef = useRef(null);

  const handleInterviewReady = (data) => {
    console.log("✅ Interview session ready:", data);

    // ✅ Verify stream is actually alive
    const videoTrack = data.cameraStream?.getVideoTracks()[0];

    if (!videoTrack) {
      console.error("❌ No video track in stream!");
      alert("Camera stream invalid. Please refresh and try again.");
      return;
    }

    if (videoTrack.readyState !== "live") {
      console.error("❌ Video track not live:", videoTrack.readyState);
      alert(
        `Camera track is ${videoTrack.readyState}. Please refresh and try again.`,
      );
      return;
    }

    console.log("✅ Stream verified:", {
      active: data.cameraStream.active,
      videoTrack: {
        label: videoTrack.label,
        readyState: videoTrack.readyState,
        enabled: videoTrack.enabled,
      },
    });

    // ✅ Store in both state and ref
    cameraStreamRef.current = data.cameraStream;
    setSession(data);
  };

  const handleCancelInterview = () => {
    console.log("🛑 Canceling interview");

    // ✅ Stop camera stream
    const stream = session?.cameraStream || cameraStreamRef.current;
    if (stream) {
      console.log("🛑 Stopping camera stream");
      stream.getTracks().forEach((track) => {
        console.log(`🛑 Stopping ${track.kind} track (${track.readyState})`);
        track.stop();
      });
    }

    cameraStreamRef.current = null;
    setSession(null);
  };

  const handleFinish = () => {
    console.log("✅ Interview finished");

    // ✅ Stop camera stream on completion
    const stream = session?.cameraStream || cameraStreamRef.current;
    if (stream) {
      console.log("🛑 Stopping camera after interview");
      stream.getTracks().forEach((track) => track.stop());
    }

    cameraStreamRef.current = null;
    setShowSubmissionModal(true);
  };

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      const stream = cameraStreamRef.current;
      if (stream) {
        console.log("🧹 Cleaning up camera stream on unmount");
        stream.getTracks().forEach((track) => track.stop());
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
