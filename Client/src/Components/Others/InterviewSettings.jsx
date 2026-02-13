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
import QRCode from "qrcode";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

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

  // Modal states
  const [openGuideLines, setOpenGuideLines] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const [sessionData, setSessionData] = useState(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsReady, setQuestionsReady] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secondaryCameraConnected, setSecondaryCameraConnected] =
    useState(false);

  const hasExistingSkills = user?.skill && user.skill.trim() !== "";

  const selectedSkillsRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const hasStartedInterviewRef = useRef(false);
  // Socket ref for listening to mobile camera connection in settings phase
  const settingsSocketRef = useRef(null);

  useEffect(() => {
    if (hasExistingSkills) {
      const skillsArray = user.skill
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setValue("skills", skillsArray);
    }
  }, [user, hasExistingSkills, setValue]);

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
      setOpenGuideLines(true);
      setStatus("succeeded");
    } catch (err) {
      console.error("❌ Submit error:", err);
      setError(err?.message || "Failed to start interview");
      setStatus("failed");
    }
  };

  // Generate QR code with passed session data
  const generateQRCode = async (sessionInfo) => {
    try {
      console.log("📱 generateQRCode called with:", sessionInfo);

      if (!sessionInfo?.interviewId || !user?.id) {
        setError("Session not ready. Please try again.");
        return;
      }

      const mobileUrl = `${window.location.origin}/mobile-camera?mobile=true&session=${sessionInfo.interviewId}&userId=${user.id}`;
      console.log("📱 Generating QR code for:", mobileUrl);

      const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      setQrCodeDataUrl(qrDataUrl);
      console.log("✅ QR code generated successfully");
      return qrDataUrl;
    } catch (err) {
      console.error("❌ QR code generation error:", err);
      setError("Failed to generate QR code");
      throw err;
    }
  };

  // ── Socket listener for mobile camera connection (settings phase only) ──
  useEffect(() => {
    if (!showQRModal || !sessionData) return;

    console.log("📡 Connecting settings socket to listen for mobile camera...");

    const socket = io(SOCKET_URL, {
      query: {
        interviewId: sessionData.interviewId,
        userId: sessionData.userId,
      },
      transports: ["websocket", "polling"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 5,
    });

    settingsSocketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Settings socket connected:", socket.id);
    });

    // Server emits this when mobile sends secondary_camera_connected
    socket.on("secondary_camera_ready", (data) => {
      console.log("📱 Mobile camera confirmed by server:", data);
      setSecondaryCameraConnected(true);
      setQuestionsReady(true);
      setIsGeneratingQuestions(false);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Settings socket error:", err);
    });

    return () => {
      console.log("🔌 Disconnecting settings socket");
      socket.disconnect();
      settingsSocketRef.current = null;
    };
  }, [showQRModal, sessionData]);

  // Handle primary camera success
  const handleCameraSuccess = async (stream) => {
    console.log("📹 Primary camera stream received");
    cameraStreamRef.current = stream;

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener(
        "ended",
        () => {
          console.error("❌ CRITICAL: Primary camera track ended!");
          alert("Primary camera stopped. Please refresh and try again.");
        },
        { once: true },
      );
    }

    setIsGeneratingQuestions(true);

    try {
      const result = await dispatch(
        startInterview({
          skills: !hasExistingSkills ? selectedSkillsRef.current : undefined,
        }),
      ).unwrap();

      if (!result?.sessionId)
        throw new Error("Session ID not returned from server");
      if (!user?.id) throw new Error("User ID not available");

      const newSessionData = {
        interviewId: result.sessionId,
        userId: user.id,
      };

      console.log("✅ Session data created:", newSessionData);
      setSessionData(newSessionData);

      setIsCameraOpen(false);
      await generateQRCode(newSessionData);
      setShowQRModal(true);

      console.log("✅ QR modal shown, waiting for mobile connection...");
    } catch (err) {
      console.error("❌ Session creation error:", err);
      setError(err?.message || "Failed to create interview session");
      setIsGeneratingQuestions(false);

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    }
  };

  // Start interview — no local secondary stream needed (it lives on mobile)
  const tryStartInterview = () => {
    const canStart =
      questionsReady &&
      sessionData &&
      cameraStreamRef.current &&
      secondaryCameraConnected &&
      !isGeneratingQuestions &&
      !hasStartedInterviewRef.current;

    console.log("🔍 tryStartInterview check:", {
      questionsReady,
      hasSessionData: !!sessionData,
      hasPrimaryStream: !!cameraStreamRef.current,
      secondaryCameraConnected,
      isGenerating: isGeneratingQuestions,
      hasStarted: hasStartedInterviewRef.current,
      canStart,
    });

    if (!canStart) return;

    hasStartedInterviewRef.current = true;

    const primaryStream = cameraStreamRef.current;
    const primaryVideoTrack = primaryStream.getVideoTracks()[0];

    if (!primaryVideoTrack) {
      setError("No primary video track found. Please refresh and try again.");
      hasStartedInterviewRef.current = false;
      return;
    }

    if (primaryVideoTrack.readyState !== "live") {
      setError(
        `Primary camera is ${primaryVideoTrack.readyState}. Please refresh.`,
      );
      hasStartedInterviewRef.current = false;
      return;
    }

    if (!primaryStream.active) {
      setError("Primary camera stream is not active. Please refresh.");
      hasStartedInterviewRef.current = false;
      return;
    }

    console.log("✅ ALL CHECKS PASSED - Starting interview");
    setError(null);
    setShowQRModal(false);

    try {
      // secondaryCameraStream is null here — it lives on the mobile browser
      // InterviewQuestions handles it independently via useSecondaryCamera hook
      onInterviewReady({
        ...sessionData,
        cameraStream: primaryStream,
        secondaryCameraStream: null,
      });
    } catch (err) {
      console.error("❌ Error starting interview:", err);
      alert("Failed to start interview: " + err.message);
      hasStartedInterviewRef.current = false;
    }
  };

  // Watch for all conditions to start interview
  useEffect(() => {
    if (questionsReady && secondaryCameraConnected && !isGeneratingQuestions) {
      console.log("✅ All conditions met, attempting to start interview...");
      tryStartInterview();
    }
  }, [questionsReady, secondaryCameraConnected, isGeneratingQuestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!hasStartedInterviewRef.current) {
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        }
      }
      cameraStreamRef.current = null;
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
        onClose={() => setOpenGuideLines(false)}
        title="AI Interview Guidelines"
        size="xl"
      >
        <Guidlines
          onClick={() => {
            setOpenGuideLines(false);
            setIsMicOpen(true);
          }}
        />
      </Modal>

      {/* Microphone Check - Step 2 */}
      <MicrophoneCheck
        isOpen={isMicOpen}
        onClose={() => setIsMicOpen(false)}
        onSuccess={() => {
          setIsMicOpen(false);
          setIsCameraOpen(true);
        }}
      />

      {/* Primary Camera Check - Step 3 */}
      <CameraCheck
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSuccess={handleCameraSuccess}
        facingMode="environment"
        title="Primary Camera Setup"
        description="Please allow access to your camera. After this, you'll need to connect your mobile phone's front camera."
      />

      {/* QR Code Modal - Step 4 - stays open until mobile connects */}
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

          {isGeneratingQuestions && !qrCodeDataUrl && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                    Creating Interview Session...
                  </p>
                  <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                    Please wait while we set up your interview
                  </p>
                </div>
              </div>
            </div>
          )}

          {qrCodeDataUrl && (
            <>
              <div className="flex justify-center">
                <div className="p-6 bg-white rounded-2xl shadow-2xl border-4 border-gray-200">
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code for Mobile Camera"
                    className="w-64 h-64"
                  />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-4">
                  Instructions:
                </h4>
                <ol className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                  {[
                    "Open your phone's camera app",
                    "Point your camera at the QR code above",
                    "Tap the notification to open the link",
                    "Grant camera permission when prompted",
                    "Keep your phone steady with the front camera facing you",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {!secondaryCameraConnected && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span>Waiting for mobile camera connection...</span>
                </div>
              )}
            </>
          )}

          {secondaryCameraConnected && (
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
                    ✅ Mobile Camera Connected!
                  </p>
                  <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                    {questionsReady
                      ? "Starting interview..."
                      : "Preparing interview questions..."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default InterviewSettings;
