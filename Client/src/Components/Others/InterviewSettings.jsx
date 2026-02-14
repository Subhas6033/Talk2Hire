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
  const settingsSocketRef = useRef(null);
  const questionGenerationStartedRef = useRef(false);
  const socketInitializedRef = useRef(false);

  useEffect(() => {
    if (hasExistingSkills) {
      const skillsArray = user.skill
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setValue("skills", skillsArray);
    }
  }, [user, hasExistingSkills, setValue]);

  // Start question generation in the background
  const startQuestionGeneration = async () => {
    if (questionGenerationStartedRef.current) {
      console.log("⚠️ Question generation already started, skipping");
      return;
    }

    questionGenerationStartedRef.current = true;
    setIsGeneratingQuestions(true);

    try {
      console.log("🎯 Starting question generation in background...");
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

      console.log(
        "✅ Questions generated, session data created:",
        newSessionData,
      );
      setSessionData(newSessionData);
      setQuestionsReady(true);
      setIsGeneratingQuestions(false);
    } catch (err) {
      console.error("❌ Question generation error:", err);
      setError(err?.message || "Failed to generate interview questions");
      setIsGeneratingQuestions(false);
      questionGenerationStartedRef.current = false;
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

      // Start question generation immediately after clicking "Start Interview"
      startQuestionGeneration();

      setOpenGuideLines(true);
      setStatus("succeeded");
    } catch (err) {
      console.error("❌ Submit error:", err);
      setError(err?.message || "Failed to start interview");
      setStatus("failed");
    }
  };

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
        width: 280,
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

  // Initialize socket and QR when questions are ready
  const initializeSocketAndQR = async () => {
    if (socketInitializedRef.current || !sessionData) return;

    socketInitializedRef.current = true;

    try {
      console.log("📡 Initializing socket for mobile frames...");
      const socket = io(SOCKET_URL, {
        query: {
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
        },
        transports: ["websocket", "polling"],
        path: "/socket.io",
        reconnection: true,
        reconnectionAttempts: 5,
        autoConnect: true,
      });

      settingsSocketRef.current = socket;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Socket connection timeout"));
        }, 10000);

        socket.once("connect", () => {
          clearTimeout(timeout);
          console.log("✅ Settings socket connected:", socket.id);
          resolve();
        });

        socket.on("connect_error", (err) => {
          clearTimeout(timeout);
          console.error("❌ Socket connection failed:", err);
          reject(err);
        });
      });

      socket.on("secondary_camera_ready", (data) => {
        console.log("📱 Mobile camera confirmed by server:", data);
        setSecondaryCameraConnected(true);
      });

      socket.on("secondary_camera_status", (data) => {
        if (data.connected) {
          console.log("📱 Secondary camera status update:", data);
          setSecondaryCameraConnected(true);
        }
      });

      socket.emit("request_secondary_camera_status", {
        interviewId: sessionData.interviewId,
      });

      await generateQRCode(sessionData);
      console.log("✅ Socket and QR code ready");
    } catch (err) {
      console.error("❌ Socket/QR initialization error:", err);
      setError(err?.message || "Failed to initialize connection");
      socketInitializedRef.current = false;
    }
  };

  // Initialize socket and QR when questions become ready
  useEffect(() => {
    if (
      questionsReady &&
      sessionData &&
      showQRModal &&
      !socketInitializedRef.current
    ) {
      initializeSocketAndQR();
    }
  }, [questionsReady, sessionData, showQRModal]);

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

    // Just show QR modal immediately, we'll wait for questions there
    setIsCameraOpen(false);
    setShowQRModal(true);
  };

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

    if (settingsSocketRef.current) {
      console.log("🔌 Disconnecting settings socket before interview starts");
      settingsSocketRef.current.disconnect();
      settingsSocketRef.current = null;
    }

    try {
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

  useEffect(() => {
    if (questionsReady && secondaryCameraConnected && !isGeneratingQuestions) {
      console.log("✅ All conditions met, attempting to start interview...");
      tryStartInterview();
    }
  }, [questionsReady, secondaryCameraConnected, isGeneratingQuestions]);

  useEffect(() => {
    return () => {
      console.log("🧹 InterviewSettings cleanup");

      if (settingsSocketRef.current) {
        settingsSocketRef.current.disconnect();
        settingsSocketRef.current = null;
      }

      if (!hasStartedInterviewRef.current) {
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        }
      }
      cameraStreamRef.current = null;
      hasStartedInterviewRef.current = false;
      questionGenerationStartedRef.current = false;
      socketInitializedRef.current = false;
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

      <MicrophoneCheck
        isOpen={isMicOpen}
        onClose={() => setIsMicOpen(false)}
        onSuccess={() => {
          setIsMicOpen(false);
          setIsCameraOpen(true);
        }}
      />

      <CameraCheck
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSuccess={handleCameraSuccess}
        facingMode="environment"
        title="Primary Camera Setup"
        description="Please allow access to your camera. After this, you'll need to connect your mobile phone's front camera."
      />

      <Modal
        isOpen={showQRModal}
        onClose={() => {}}
        title="📱 Connect Mobile Camera"
        size="full"
      >
        {/* Modern horizontal layout with scrolling on small screens */}
        <div className="flex flex-col lg:flex-row gap-8 overflow-x-auto lg:overflow-x-visible pb-4">
          {/* Left Panel - QR Code Section */}
          <div className="shrink-0 lg:w-1/2 space-y-6">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-orange-500 via-red-500 to-pink-600 shadow-2xl shadow-orange-500/30 mb-4">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold bg-linear-to-r from-white to-white/80 bg-clip-text text-transparent">
                Scan with Your Phone
              </h3>
              <p className="text-white/50 text-sm max-w-sm mx-auto leading-relaxed">
                Open your phone's camera app and point it at the QR code below
              </p>
            </div>

            {/* QR Code Display */}
            <div className="flex justify-center">
              {qrCodeDataUrl ? (
                <div className="relative group">
                  <div className="absolute -inset-1 bg-linear-to-r from-purple-600 via-pink-600 to-orange-600 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition duration-500"></div>
                  <div className="relative p-6 bg-white rounded-3xl shadow-2xl">
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code for Mobile Camera"
                      className="w-64 h-64 rounded-xl"
                    />
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute -inset-1 bg-linear-to-r from-purple-600 to-pink-600 rounded-3xl blur-xl opacity-30 animate-pulse"></div>
                  <div className="relative w-72 h-72 bg-linear-to-br from-white/5 to-white/10 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                    <div className="space-y-4 text-center">
                      <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto" />
                      <p className="text-white/60 text-sm font-medium">
                        Generating QR Code...
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* QR Code Status */}
            {!qrCodeDataUrl && questionsReady && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-blue-300 text-sm font-medium">
                    Preparing connection...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Status & Instructions */}
          <div className="shrink-0 lg:w-1/2 space-y-5">
            {/* Question Generation Status */}
            {isGeneratingQuestions && !questionsReady && (
              <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 p-5 backdrop-blur-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="relative flex items-start gap-4">
                  <div className="shrink-0 mt-1">
                    <div className="animate-spin w-6 h-6 border-3 border-blue-400/30 border-t-blue-400 rounded-full" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-blue-300 mb-1">
                      Generating Interview Questions
                    </p>
                    <p className="text-sm text-blue-400/80 leading-relaxed">
                      AI is preparing personalized questions based on your
                      skills. This usually takes 10-15 seconds.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Questions Ready Status */}
            {questionsReady && !secondaryCameraConnected && (
              <div className="relative mr-5 overflow-hidden rounded-2xl bg-linear-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-5 backdrop-blur-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
                <div className="relative flex items-start gap-4">
                  <div className="shrink-0">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-green-300 mb-1">
                      Questions Ready!
                    </p>
                    <p className="text-sm text-green-400/80 leading-relaxed">
                      Your personalized interview is prepared. Connect your
                      mobile camera to continue.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions Card */}
            <div className="relative mr-5 overflow-hidden rounded-2xl bg-linear-to-br from-white/5 to-white/10 border border-white/10 p-6 backdrop-blur-sm">
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-purple-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                  </div>
                  <h4 className="font-bold text-white/90 text-lg">
                    Setup Instructions
                  </h4>
                </div>
                <ol className="space-y-4">
                  {[
                    { icon: "📱", text: "Open your phone's camera app" },
                    { icon: "🎯", text: "Point at the QR code on the left" },
                    { icon: "🔔", text: "Tap the notification that appears" },
                    { icon: "✅", text: "Grant camera permission" },
                    { icon: "📹", text: "Position front camera facing you" },
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-4 group">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shadow-lg group-hover:scale-110 transition-transform">
                        {i + 1}
                      </div>
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-xl">{step.icon}</span>
                        <span className="text-white/70 text-sm leading-relaxed group-hover:text-white/90 transition-colors">
                          {step.text}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Mobile Camera Connection Status */}
            {!secondaryCameraConnected && qrCodeDataUrl && (
              <div className="mr-5 flex items-center justify-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-blue-400 animate-ping absolute"></div>
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                </div>
                <span className="text-white/60 text-sm font-medium">
                  Waiting for mobile camera connection...
                </span>
              </div>
            )}

            {/* Success Status */}
            {secondaryCameraConnected && (
              <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-5 backdrop-blur-sm">
                <div className="absolute top-0 right-0 w-40 h-40 bg-green-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="relative flex items-start gap-4">
                  <div className="shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-green-500/30">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-green-300 mb-1">
                      Mobile Camera Connected!
                    </p>
                    <p className="text-sm text-green-400/80 leading-relaxed">
                      {questionsReady
                        ? "All set! Starting your interview now..."
                        : "Waiting for questions to be ready..."}
                    </p>
                    {questionsReady && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full"></div>
                        <span className="text-xs text-green-300 font-medium">
                          Launching interview...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default InterviewSettings;
