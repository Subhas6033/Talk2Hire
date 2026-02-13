import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  SkillsSelector,
  Button,
  Guidlines,
  Modal,
  MicrophoneCheck,
  CameraCheck,
} from "../index";
import { Card } from "../Common/Card";
import { useDispatch, useSelector } from "react-redux";
import { startInterview } from "../../API/interviewApi";
import QRCode from "qrcode"; // ✅ ADD: npm install qrcode

const InterviewSettings = ({ onInterviewReady }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const { watch, setValue, handleSubmit } = useForm({
    mode: "onChange",
    defaultValues: { skills: [] },
  });

  const skills = watch("skills");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  // ✅ Modal states - control flow properly
  const [openGuideLines, setOpenGuideLines] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false); // ✅ NEW: QR modal state

  const [sessionData, setSessionData] = useState(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsReady, setQuestionsReady] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(""); // ✅ NEW: QR code image

  const hasExistingSkills = user?.skill && user.skill.trim() !== "";

  const selectedSkillsRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const secondaryCameraStreamRef = useRef(null);
  const hasStartedInterviewRef = useRef(false);

  useEffect(() => {
    if (hasExistingSkills) {
      const skillsArray = user.skill
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setValue("skills", skillsArray);
    }
  }, [user, hasExistingSkills, setValue]);

  // ✅ UPDATED: Generate questions ONLY after both cameras connected
  const generateQuestionsInBackground = async () => {
    if (!user?.id) {
      setError("User not authenticated.");
      return;
    }

    try {
      setIsGeneratingQuestions(true);
      setQuestionsReady(false);

      console.log("🔄 Generating questions in background...");

      const result = await dispatch(
        startInterview({
          skills: !hasExistingSkills ? selectedSkillsRef.current : undefined,
        }),
      ).unwrap();

      if (!result?.sessionId) {
        throw new Error("Session ID not returned from server");
      }

      const newSessionData = {
        interviewId: result.sessionId,
        userId: user?.id,
      };

      setSessionData(newSessionData);
      setQuestionsReady(true);
      setIsGeneratingQuestions(false);

      console.log("✅ Questions ready:", newSessionData);
    } catch (err) {
      console.error("❌ Question generation error:", err);
      setError(err?.message || "Failed to generate questions");
      setIsGeneratingQuestions(false);
      setQuestionsReady(false);
    }
  };

  const onSubmit = async () => {
    if (!hasExistingSkills && (!skills || skills.length === 0)) {
      setError("Please select at least one skill to continue.");
      return;
    }

    if (!user?.id) {
      setError("User not authenticated.");
      return;
    }

    try {
      setStatus("loading");
      setError(null);

      selectedSkillsRef.current = skills;

      // ✅ DON'T start generating questions yet - wait until both cameras connected

      // ✅ Open guidelines modal (first step)
      setOpenGuideLines(true);
      setStatus("succeeded");
    } catch (err) {
      console.error("❌ Submit error:", err);
      setError(err?.message || "Failed to start interview");
      setStatus("failed");
    }
  };

  // ✅ Handle primary camera success
  const handleCameraSuccess = (stream) => {
    console.log("📹 Primary camera stream received");

    cameraStreamRef.current = stream;

    const videoTrack = stream.getVideoTracks()[0];

    console.log("📹 Primary camera stored and verified:", {
      streamId: stream.id,
      active: stream.active,
      trackState: videoTrack?.readyState,
      trackEnabled: videoTrack?.enabled,
    });

    if (videoTrack) {
      videoTrack.addEventListener(
        "ended",
        () => {
          console.error(
            "❌ CRITICAL: Primary camera track ended unexpectedly!",
          );
          alert("Primary camera stopped. Please refresh and try again.");
        },
        { once: true },
      );
    }

    // ✅ Close primary camera modal
    setIsCameraOpen(false);

    // ✅ NEW: Show QR code modal for mobile connection
    generateQRCode();
    setShowQRModal(true);

    console.log(
      "✅ Primary camera ready, showing QR code for mobile connection...",
    );
  };

  // ✅ NEW: Generate QR code for mobile camera connection
  const generateQRCode = async () => {
    try {
      // Build mobile camera URL
      const mobileUrl = `${window.location.origin}/mobile-camera?mobile=true&session=${user?.id}&userId=${user?.id}`;

      console.log("📱 Generating QR code for:", mobileUrl);

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQrCodeDataUrl(qrDataUrl);
      console.log("✅ QR code generated");
    } catch (err) {
      console.error("❌ QR code generation error:", err);
      setError("Failed to generate QR code");
    }
  };

  // ✅ NEW: Handle secondary camera success (from mobile phone)
  const handleSecondaryCameraSuccess = (stream) => {
    console.log("📱 Secondary camera stream received (from mobile)");

    secondaryCameraStreamRef.current = stream;

    const videoTrack = stream.getVideoTracks()[0];

    console.log("📱 Secondary camera stored and verified:", {
      streamId: stream.id,
      active: stream.active,
      trackState: videoTrack?.readyState,
      trackEnabled: videoTrack?.enabled,
    });

    if (videoTrack) {
      videoTrack.addEventListener(
        "ended",
        () => {
          console.error(
            "❌ CRITICAL: Secondary camera track ended unexpectedly!",
          );
          alert("Secondary camera stopped. Please refresh and try again.");
        },
        { once: true },
      );
    }

    // ✅ Close QR modal
    setShowQRModal(false);

    console.log("✅ Both cameras ready, starting question generation...");

    // ✅ NEW: Start generating questions NOW (after both cameras connected)
    generateQuestionsInBackground();
  };

  // ✅ UPDATED: Start interview only when BOTH cameras + questions ready
  const tryStartInterview = () => {
    const canStart =
      questionsReady &&
      sessionData &&
      cameraStreamRef.current &&
      secondaryCameraStreamRef.current && // ✅ Require secondary camera
      !isGeneratingQuestions &&
      !hasStartedInterviewRef.current;

    console.log("🔍 tryStartInterview check:", {
      questionsReady,
      hasSessionData: !!sessionData,
      hasPrimaryStream: !!cameraStreamRef.current,
      hasSecondaryStream: !!secondaryCameraStreamRef.current,
      primaryStreamActive: cameraStreamRef.current?.active,
      secondaryStreamActive: secondaryCameraStreamRef.current?.active,
      isGenerating: isGeneratingQuestions,
      hasStarted: hasStartedInterviewRef.current,
      canStart,
    });

    if (!canStart) {
      console.log("⏳ Not ready yet, waiting for:", {
        needQuestions: !questionsReady,
        needSession: !sessionData,
        needPrimaryCamera: !cameraStreamRef.current,
        needSecondaryCamera: !secondaryCameraStreamRef.current,
      });
      return;
    }

    hasStartedInterviewRef.current = true;

    const primaryStream = cameraStreamRef.current;
    const secondaryStream = secondaryCameraStreamRef.current;

    // ✅ Verify primary camera
    const primaryVideoTrack = primaryStream.getVideoTracks()[0];
    if (!primaryVideoTrack) {
      console.error("❌ No primary video track!");
      setError("No primary video track found. Please refresh and try again.");
      hasStartedInterviewRef.current = false;
      return;
    }

    if (primaryVideoTrack.readyState !== "live") {
      console.error(
        "❌ Primary video track not live:",
        primaryVideoTrack.readyState,
      );
      setError(
        `Primary video track is ${primaryVideoTrack.readyState}. Please refresh and try again.`,
      );
      hasStartedInterviewRef.current = false;
      return;
    }

    if (!primaryStream.active) {
      console.error("❌ Primary stream not active!");
      setError(
        "Primary camera stream is not active. Please refresh and try again.",
      );
      hasStartedInterviewRef.current = false;
      return;
    }

    // ✅ Verify secondary camera
    const secondaryVideoTrack = secondaryStream.getVideoTracks()[0];
    if (!secondaryVideoTrack) {
      console.error("❌ No secondary video track!");
      setError("No secondary video track found. Please refresh and try again.");
      hasStartedInterviewRef.current = false;
      return;
    }

    if (secondaryVideoTrack.readyState !== "live") {
      console.error(
        "❌ Secondary video track not live:",
        secondaryVideoTrack.readyState,
      );
      setError(
        `Secondary video track is ${secondaryVideoTrack.readyState}. Please refresh and try again.`,
      );
      hasStartedInterviewRef.current = false;
      return;
    }

    if (!secondaryStream.active) {
      console.error("❌ Secondary stream not active!");
      setError(
        "Secondary camera stream is not active. Please refresh and try again.",
      );
      hasStartedInterviewRef.current = false;
      return;
    }

    console.log("✅ ALL VERIFICATIONS PASSED - Starting interview:", {
      primaryStreamActive: primaryStream.active,
      primaryTrackState: primaryVideoTrack.readyState,
      secondaryStreamActive: secondaryStream.active,
      secondaryTrackState: secondaryVideoTrack.readyState,
      sessionId: sessionData.interviewId,
    });

    setError(null);

    // ✅ Start interview with both camera streams
    try {
      onInterviewReady({
        ...sessionData,
        cameraStream: primaryStream,
        secondaryCameraStream: secondaryStream,
      });
    } catch (err) {
      console.error("❌ Error starting interview:", err);
      alert("Failed to start interview: " + err.message);
      hasStartedInterviewRef.current = false;
    }
  };

  // ✅ Watch for questions ready
  useEffect(() => {
    if (questionsReady && !isGeneratingQuestions) {
      console.log("✅ Questions ready, attempting to start interview...");
      tryStartInterview();
    }
  }, [questionsReady, isGeneratingQuestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!hasStartedInterviewRef.current) {
        if (cameraStreamRef.current) {
          console.log("🛑 Stopping primary camera (interview never started)");
          cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (secondaryCameraStreamRef.current) {
          console.log("🛑 Stopping secondary camera (interview never started)");
          secondaryCameraStreamRef.current
            .getTracks()
            .forEach((track) => track.stop());
        }
      }

      cameraStreamRef.current = null;
      secondaryCameraStreamRef.current = null;
      hasStartedInterviewRef.current = false;
    };
  }, []);

  return (
    <>
      <Card className="p-6 sm:p-8">
        {!hasExistingSkills ? (
          <div className="mb-10">
            <SkillsSelector
              selectedSkills={skills || []}
              onSkillsChange={(newSkills) =>
                setValue("skills", newSkills, { shouldValidate: true })
              }
            />
          </div>
        ) : (
          <div className="mb-10">
            <Card variant="default" padding="lg" className="w-full">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-green-500">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-semibold">
                    Skills Already Configured
                  </span>
                </div>
                <p className="text-sm text-white/70">
                  Your skills are on file. You can proceed directly to the
                  interview.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-4 p-3 bg-white/5 rounded-lg border border-white/10 max-w-2xl mx-auto">
                  {user.skill.split(",").map((skill, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center px-3 py-1.5 bg-purpleGlow/20 border border-purpleGlow rounded-lg text-purpleGlow text-xs font-medium"
                    >
                      {skill.trim()}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={
                (!hasExistingSkills && (!skills || skills.length === 0)) ||
                status === "loading"
              }
              className="px-10"
            >
              {status === "loading" ? "Starting Setup..." : "Start Interview"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Guidelines Modal - Step 1 */}
      <Modal
        isOpen={openGuideLines}
        onClose={() => {
          setOpenGuideLines(false);
        }}
        title="AI Interview Guidelines"
        size="xl"
      >
        <Guidlines
          onClick={() => {
            setOpenGuideLines(false);
            setIsMicOpen(true); // Go to mic check
          }}
        />
      </Modal>

      {/* Microphone Check - Step 2 */}
      <MicrophoneCheck
        isOpen={isMicOpen}
        onClose={() => setIsMicOpen(false)}
        onSuccess={() => {
          setIsMicOpen(false);
          setIsCameraOpen(true); // Go to camera check
        }}
      />

      {/* Primary Camera Check - Step 3 */}
      <CameraCheck
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSuccess={handleCameraSuccess}
        facingMode="environment" // Back/primary camera
        title="Primary Camera Setup"
        description="Please allow access to your camera. After this, you'll need to connect your mobile phone's front camera."
      />

      {/* ✅ NEW: QR Code Modal - Step 4 */}
      <Modal
        isOpen={showQRModal}
        onClose={() => {}}
        title="📱 Connect Mobile Camera"
        size="lg"
      >
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-linear-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-6 shadow-xl">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-4">
              Scan QR Code with Your Phone
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Use your mobile phone's camera app to scan this QR code and
              connect your front camera for additional security monitoring.
            </p>
          </div>

          {/* QR Code Display */}
          {qrCodeDataUrl && (
            <div className="flex justify-center">
              <div className="p-6 bg-white rounded-2xl shadow-2xl border-4 border-gray-200">
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code for Mobile Camera"
                  className="w-64 h-64"
                />
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-4">
              Instructions:
            </h4>
            <ol className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>Open your phone's camera app</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>Point your camera at the QR code above</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>Tap the notification to open the link</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <span>Grant camera permission when prompted</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  5
                </span>
                <span>
                  Keep your phone steady with the front camera facing you
                </span>
              </li>
            </ol>
          </div>

          {isGeneratingQuestions && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin w-5 h-5 border-3 border-green-600 border-t-transparent rounded-full" />
                <div>
                  <p className="text-sm font-semibold text-green-900 dark:text-green-300">
                    Generating Interview Questions...
                  </p>
                  <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                    Please wait while we prepare your questions
                  </p>
                </div>
              </div>
            </div>
          )}

          {questionsReady && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-900 dark:text-green-300">
                    ✅ Questions Ready!
                  </p>
                  <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                    Starting interview...
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Waiting for mobile connection...</span>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default InterviewSettings;
