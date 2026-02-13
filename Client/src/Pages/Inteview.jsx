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

  // ✅ Track BOTH streams in refs
  const cameraStreamRef = useRef(null);
  const secondaryCameraStreamRef = useRef(null); // ✅ NEW

  const handleInterviewReady = (data) => {
    console.log("✅ Interview session ready:", data);

    // ✅ Verify PRIMARY stream
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

    // ✅ Verify SECONDARY stream
    const secondaryVideoTrack = data.secondaryCameraStream?.getVideoTracks()[0];
    if (!secondaryVideoTrack) {
      console.error("❌ No secondary video track!");
      alert("Secondary camera stream invalid. Please refresh and try again.");
      return;
    }

    if (secondaryVideoTrack.readyState !== "live") {
      console.error(
        "❌ Secondary video track not live:",
        secondaryVideoTrack.readyState,
      );
      alert(
        `Secondary camera is ${secondaryVideoTrack.readyState}. Please refresh and try again.`,
      );
      return;
    }

    console.log("✅ Both streams verified:", {
      primary: {
        active: data.cameraStream.active,
        trackState: videoTrack.readyState,
      },
      secondary: {
        active: data.secondaryCameraStream.active,
        trackState: secondaryVideoTrack.readyState,
      },
    });

    // ✅ Store BOTH streams in refs
    cameraStreamRef.current = data.cameraStream;
    secondaryCameraStreamRef.current = data.secondaryCameraStream; // ✅ NEW
    setSession(data);
  };

  const handleCancelInterview = () => {
    console.log("🛑 Canceling interview");

    // ✅ Stop PRIMARY camera
    const primaryStream = session?.cameraStream || cameraStreamRef.current;
    if (primaryStream) {
      console.log("🛑 Stopping primary camera stream");
      primaryStream.getTracks().forEach((track) => {
        console.log(
          `🛑 Stopping primary ${track.kind} track (${track.readyState})`,
        );
        track.stop();
      });
    }

    // ✅ Stop SECONDARY camera
    const secondaryStream =
      session?.secondaryCameraStream || secondaryCameraStreamRef.current;
    if (secondaryStream) {
      console.log("🛑 Stopping secondary camera stream");
      secondaryStream.getTracks().forEach((track) => {
        console.log(
          `🛑 Stopping secondary ${track.kind} track (${track.readyState})`,
        );
        track.stop();
      });
    }

    cameraStreamRef.current = null;
    secondaryCameraStreamRef.current = null;
    setSession(null);
  };

  const handleFinish = () => {
    console.log("✅ Interview finished");

    // ✅ Stop both cameras on completion
    const primaryStream = session?.cameraStream || cameraStreamRef.current;
    if (primaryStream) {
      console.log("🛑 Stopping primary camera after interview");
      primaryStream.getTracks().forEach((track) => track.stop());
    }

    const secondaryStream =
      session?.secondaryCameraStream || secondaryCameraStreamRef.current;
    if (secondaryStream) {
      console.log("🛑 Stopping secondary camera after interview");
      secondaryStream.getTracks().forEach((track) => track.stop());
    }

    cameraStreamRef.current = null;
    secondaryCameraStreamRef.current = null;
    setShowSubmissionModal(true);
  };

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      const primaryStream = cameraStreamRef.current;
      if (primaryStream) {
        console.log("🧹 Cleaning up primary camera on unmount");
        primaryStream.getTracks().forEach((track) => track.stop());
      }

      const secondaryStream = secondaryCameraStreamRef.current;
      if (secondaryStream) {
        console.log("🧹 Cleaning up secondary camera on unmount");
        secondaryStream.getTracks().forEach((track) => track.stop());
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
            secondaryCameraStream={session.secondaryCameraStream} // ✅ Pass secondary camera
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
