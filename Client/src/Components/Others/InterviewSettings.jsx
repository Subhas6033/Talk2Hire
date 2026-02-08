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
  const [showSecuritySetup, setShowSecuritySetup] = useState(false);

  const [sessionData, setSessionData] = useState(null);
  const [primaryCameraStream, setPrimaryCameraStream] = useState(null);

  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsReady, setQuestionsReady] = useState(false);

  const hasExistingSkills = user?.skill && user.skill.trim() !== "";

  // Store selected skills for later use
  const selectedSkillsRef = useRef(null);

  useEffect(() => {
    if (hasExistingSkills) {
      const skillsArray = user.skill
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setValue("skills", skillsArray);
    }
  }, [user, hasExistingSkills, setValue]);

  // ✅ NEW: This generates questions in the background
  const generateQuestionsInBackground = async () => {
    if (!user?.id) {
      setError("User not authenticated.");
      return;
    }

    try {
      console.log("🚀 Starting question generation in background...");
      setIsGeneratingQuestions(true);
      setQuestionsReady(false);

      // Start question generation
      const result = await dispatch(
        startInterview({
          skills: !hasExistingSkills ? selectedSkillsRef.current : undefined,
        }),
      ).unwrap();

      console.log("✅ Questions generated:", result);

      if (!result?.sessionId) {
        throw new Error("Session ID not returned from server");
      }

      setSessionData({
        interviewId: result.sessionId,
        userId: user?.id,
      });

      // Mark questions as ready
      setQuestionsReady(true);
      setIsGeneratingQuestions(false);
      console.log("✅ Questions ready, sessionId:", result.sessionId);
    } catch (err) {
      console.error("❌ Question generation error:", err);
      setError(err?.message || "Failed to generate questions");
      setIsGeneratingQuestions(false);
      setQuestionsReady(false);
    }
  };

  // ✅ MODIFIED: Just open guidelines, don't generate questions yet
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

      // Store skills for later
      selectedSkillsRef.current = skills;

      console.log("📋 Opening guidelines modal...");

      // Just open guidelines - questions will generate in background
      setOpenGuideLines(true);
      setStatus("succeeded");

      // ✅ Start generating questions in background immediately
      generateQuestionsInBackground();
    } catch (err) {
      console.error("❌ Submit error:", err);
      setError(err?.message || "Failed to start interview");
      setStatus("failed");
    }
  };

  const handleCameraSuccess = (stream) => {
    console.log("📹 Primary camera stream received");
    setPrimaryCameraStream(stream);
    setIsCameraOpen(false);
    setShowSecuritySetup(true);
  };

  const handleSecuritySetupComplete = () => {
    console.log("🔍 Security setup complete - checking ALL conditions...");

    const conditions = {
      questionsReady,
      sessionData: !!sessionData,
      primaryCameraStream: !!primaryCameraStream,
      notGenerating: !isGeneratingQuestions,
    };

    console.log("📊 Condition check:", conditions);

    if (!questionsReady) {
      console.log("⏳ Questions not ready yet");
      setError("Questions are still being generated. Please wait...");
      return;
    }

    if (isGeneratingQuestions) {
      console.log("⏳ Questions still generating");
      setError("Questions are being generated. Please wait...");
      return;
    }

    if (!sessionData) {
      console.error("❌ No session data available");
      setError("Session data not available. Please try again.");
      return;
    }

    if (!primaryCameraStream) {
      console.error("❌ No camera stream available");
      setError("Camera stream not available. Please try again.");
      return;
    }

    console.log("✅ ALL CHECKS PASSED - Starting interview");
    setShowSecuritySetup(false);
    setError(null);

    // Start the interview
    onInterviewReady({
      ...sessionData,
      cameraStream: primaryCameraStream,
    });
  };

  useEffect(() => {
    return () => {
      if (primaryCameraStream) {
        primaryCameraStream.getTracks().forEach((track) => track.stop());
      }
      if (sessionData) {
        localStorage.removeItem(`security_${sessionData.interviewId}`);
        localStorage.removeItem(
          `security_angle_verified_${sessionData.interviewId}`,
        );
      }
    };
  }, [primaryCameraStream, sessionData]);

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
      />

      <SecurityCameraSetup
        isOpen={showSecuritySetup}
        onClose={() => {
          const confirmClose = window.confirm(
            "Security camera setup is MANDATORY to start the interview. Closing this will cancel the interview setup. Are you sure?",
          );
          if (confirmClose) {
            setShowSecuritySetup(false);
            if (primaryCameraStream) {
              primaryCameraStream.getTracks().forEach((track) => track.stop());
            }
            setPrimaryCameraStream(null);
            setSessionData(null);
            setQuestionsReady(false);
            setIsGeneratingQuestions(false);
          }
        }}
        sessionData={sessionData}
        questionsReady={questionsReady}
        isGeneratingQuestions={isGeneratingQuestions}
        onSecurityConnected={handleSecuritySetupComplete}
      />
    </>
  );
};

// ✅ Security Camera Setup Component
const SecurityCameraSetup = ({
  isOpen,
  onClose,
  sessionData,
  questionsReady,
  isGeneratingQuestions,
  onSecurityConnected,
}) => {
  const [qrCodeDataURL, setQRCodeDataURL] = useState(null);
  const [isSecurityConnected, setIsSecurityConnected] = useState(false);
  const [angleVerified, setAngleVerified] = useState(false);
  const [qrGenerationError, setQrGenerationError] = useState(null);

  // ✅ Track if we've already triggered the start
  const hasTriggeredStartRef = useRef(false);

  const generateQRCode = async () => {
    if (!sessionData) return;

    try {
      console.log("📱 Generating QR code...");
      const baseURL = window.location.origin;
      const securityURL = `${baseURL}/mobile-security?interviewId=${sessionData.interviewId}&userId=${sessionData.userId}`;

      const qrDataURL = await QRCode.toDataURL(securityURL, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      setQRCodeDataURL(qrDataURL);
      setQrGenerationError(null);
      console.log("✅ QR code generated");
    } catch (error) {
      console.error("❌ QR generation error:", error);
      setQrGenerationError(error.message);
    }
  };

  // ✅ Auto-continue when all conditions are met
  useEffect(() => {
    const allConditionsMet =
      isSecurityConnected &&
      angleVerified &&
      questionsReady &&
      !isGeneratingQuestions;

    console.log("🎯 Security setup conditions:", {
      isSecurityConnected,
      angleVerified,
      questionsReady,
      isGeneratingQuestions,
      allConditionsMet,
      hasTriggered: hasTriggeredStartRef.current,
    });

    if (allConditionsMet && !hasTriggeredStartRef.current) {
      console.log("✅ ALL CONDITIONS MET - Auto-starting interview!");
      hasTriggeredStartRef.current = true;

      const timer = setTimeout(() => {
        console.log("🚀 Invoking onSecurityConnected callback");
        onSecurityConnected?.();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [
    isSecurityConnected,
    angleVerified,
    questionsReady,
    isGeneratingQuestions,
    onSecurityConnected,
  ]);

  // ✅ Poll localStorage for security camera connection
  useEffect(() => {
    if (!isOpen || !sessionData) {
      hasTriggeredStartRef.current = false;
      return;
    }

    console.log("👀 Starting security camera detection polling...");

    const pollInterval = setInterval(() => {
      const mobileStatus = localStorage.getItem(
        `security_${sessionData.interviewId}`,
      );
      const angleStatus = localStorage.getItem(
        `security_angle_verified_${sessionData.interviewId}`,
      );

      console.log("📡 Polling localStorage:", {
        mobileStatus,
        angleStatus,
        isSecurityConnected,
        angleVerified,
      });

      if (mobileStatus === "connected" && !isSecurityConnected) {
        console.log("✅ Security camera CONNECTED detected!");
        setIsSecurityConnected(true);
      }

      if (angleStatus === "true" && !angleVerified) {
        console.log("✅ Angle VERIFIED detected!");
        setAngleVerified(true);
      }
    }, 300);

    return () => {
      console.log("🧹 Stopping security detection polling");
      clearInterval(pollInterval);
    };
  }, [isOpen, sessionData, isSecurityConnected, angleVerified]);

  // Generate QR when modal opens AND sessionData is available
  useEffect(() => {
    if (isOpen && sessionData && !qrCodeDataURL) {
      console.log("🎯 Modal open with session data, generating QR...");
      generateQRCode();
    } else if (isOpen && !sessionData) {
      console.log("⏳ Modal open but waiting for session data...");
    }
  }, [isOpen, sessionData, qrCodeDataURL]);

  // ✅ Reset trigger flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasTriggeredStartRef.current = false;
      setIsSecurityConnected(false);
      setAngleVerified(false);
      setQRCodeDataURL(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canContinue =
    isSecurityConnected &&
    angleVerified &&
    questionsReady &&
    !isGeneratingQuestions;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔒 Security Camera Setup - MANDATORY"
      size="lg"
      closeOnOverlayClick={false}
    >
      <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6">
        {/* Ready Notice */}
        {canContinue && (
          <div className="p-4 bg-green-50 dark:bg-green-950/30 border-2 border-green-500 rounded-lg animate-pulse">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-green-600 shrink-0"
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
                <h4 className="text-sm font-bold text-green-900 mb-1">
                  ✅ ALL SYSTEMS READY
                </h4>
                <p className="text-sm text-green-800">
                  Starting interview in 1 second...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Question Generation Status */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  questionsReady
                    ? "bg-green-500"
                    : isGeneratingQuestions
                      ? "bg-blue-400 animate-pulse"
                      : "bg-gray-400"
                }`}
              />
              <span className="text-sm font-medium">Interview Questions:</span>
            </div>
            <span
              className={`text-sm font-semibold ${
                questionsReady
                  ? "text-green-600"
                  : isGeneratingQuestions
                    ? "text-blue-600"
                    : "text-gray-600"
              }`}
            >
              {questionsReady
                ? "✓ Ready"
                : isGeneratingQuestions
                  ? "Generating..."
                  : "Pending"}
            </span>
          </div>
        </div>

        {/* Security Camera Status */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isSecurityConnected && angleVerified
                    ? "bg-green-500"
                    : isSecurityConnected
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-amber-400 animate-pulse"
                }`}
              />
              <span className="text-sm font-medium">Security Camera:</span>
            </div>
            <span
              className={`text-sm font-semibold ${
                isSecurityConnected && angleVerified
                  ? "text-green-600"
                  : isSecurityConnected
                    ? "text-yellow-600"
                    : "text-amber-600"
              }`}
            >
              {isSecurityConnected && angleVerified
                ? "✓ Connected & Verified"
                : isSecurityConnected
                  ? "Verifying..."
                  : "Waiting..."}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded">
            <span className="text-xs text-gray-600">Connection Status:</span>
            <span
              className={`text-xs font-semibold ${
                angleVerified ? "text-green-600" : "text-gray-500"
              }`}
            >
              {angleVerified ? "✓ Verified" : "Pending"}
            </span>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="p-6 border-2 border-blue-200 rounded-lg bg-blue-50">
          <div className="text-center space-y-4">
            <h4 className="text-lg font-bold text-blue-900">
              Scan QR Code with Mobile
            </h4>

            {/* ✅ Show waiting state if session data not ready */}
            {!sessionData ? (
              <div className="w-64 h-64 bg-blue-100 rounded-lg flex flex-col items-center justify-center mx-auto gap-3">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                <p className="text-blue-700 text-sm px-4">
                  Waiting for session data...
                </p>
              </div>
            ) : qrCodeDataURL ? (
              <div className="flex justify-center my-4">
                <div className="p-4 bg-white rounded-xl shadow-lg">
                  <img
                    src={qrCodeDataURL}
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                </div>
              </div>
            ) : qrGenerationError ? (
              <div className="w-64 h-64 bg-red-100 rounded-lg flex items-center justify-center mx-auto">
                <p className="text-red-600 text-sm px-4">{qrGenerationError}</p>
              </div>
            ) : (
              <div className="w-64 h-64 bg-gray-200 rounded-lg flex items-center justify-center mx-auto">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            )}

            <div className="text-left bg-white rounded-lg p-4">
              <h5 className="text-sm font-semibold text-blue-900 mb-3">
                📱 Setup Steps:
              </h5>
              <ol className="text-sm text-blue-800 space-y-2 ml-4">
                <li>1. Scan QR code with mobile camera</li>
                <li>2. Grant camera permissions when prompted</li>
                <li>3. Wait for camera to start streaming</li>
                <li>4. Keep device steady and positioned</li>
                <li>5. Interview will auto-start when all ready!</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Warning Info */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex gap-3">
            <svg
              className="w-5 h-5 text-amber-600 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="text-sm font-semibold text-amber-900 mb-1">
                ⚠️ Required Conditions:
              </h4>
              <p className="text-xs text-amber-800">
                • Interview questions must be generated
                <br />
                • Security camera must be connected
                <br />
                • Both conditions must be satisfied to start
                <br />• Keep security camera page open during entire interview
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <Button
          onClick={() => canContinue && onSecurityConnected?.()}
          disabled={!canContinue}
          className="w-full"
        >
          {canContinue
            ? "✓ Start Interview (Auto-starting...)"
            : !questionsReady
              ? isGeneratingQuestions
                ? "⏳ Generating Questions..."
                : "⏳ Waiting for Questions..."
              : !isSecurityConnected
                ? "⏳ Waiting for Security Camera..."
                : "⏳ Verifying Connection..."}
        </Button>
        {!canContinue && (
          <p className="text-xs text-center text-gray-500 mt-2">
            {!questionsReady
              ? isGeneratingQuestions
                ? "Please wait while questions are being generated..."
                : "Waiting for question generation to complete..."
              : !isSecurityConnected
                ? "Please scan QR code with your mobile device..."
                : "Verifying security camera connection..."}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default InterviewSettings;
