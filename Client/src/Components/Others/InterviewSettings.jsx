import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  ResumeUploadCard,
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
    defaultValues: { resume: null },
  });

  const resume = watch("resume");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [openGuideLines, setOpenGuideLines] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showSecuritySetup, setShowSecuritySetup] = useState(false);

  const [sessionData, setSessionData] = useState(null);
  const [primaryCameraStream, setPrimaryCameraStream] = useState(null);

  const onSubmit = async () => {
    if (!resume || !user?.id) return;

    try {
      setStatus("loading");
      setError(null);

      const res = await dispatch(startInterview({ resume })).unwrap();

      if (!res?.sessionId) {
        throw new Error("Session ID not returned from server");
      }

      setSessionData({
        interviewId: res.sessionId,
        userId: user?.id,
      });

      setOpenGuideLines(true);
      setStatus("succeeded");
    } catch (err) {
      setError(err?.message || "Failed to start interview");
      setStatus("failed");
    }
  };

  const handleCameraSuccess = (stream) => {
    setPrimaryCameraStream(stream);
    setIsCameraOpen(false);
    setShowSecuritySetup(true);
  };

  const handleSecuritySetupComplete = () => {
    console.log("🚀 Security setup complete, starting interview...");
    setShowSecuritySetup(false);

    if (sessionData && primaryCameraStream && onInterviewReady) {
      onInterviewReady({
        ...sessionData,
        cameraStream: primaryCameraStream,
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (primaryCameraStream) {
        primaryCameraStream.getTracks().forEach((track) => track.stop());
      }
      if (sessionData) {
        localStorage.removeItem(`security_${sessionData.interviewId}`);
        localStorage.removeItem(
          `security_angle_verified_${sessionData.interviewId}`
        );
      }
    };
  }, [primaryCameraStream, sessionData]);

  return (
    <>
      <Card className="p-6 sm:p-8">
        <div className="mb-10">
          <ResumeUploadCard
            resume={resume}
            onFileChange={(file) =>
              setValue("resume", file, { shouldValidate: true })
            }
          />
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={!resume || status === "loading"}
              className="px-10"
            >
              {status === "loading"
                ? "Setting Interview..."
                : "Start Interview"}
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
            "Security camera setup is MANDATORY to start the interview. Closing this will cancel the interview setup. Are you sure?"
          );
          if (confirmClose) {
            setShowSecuritySetup(false);
            if (primaryCameraStream) {
              primaryCameraStream.getTracks().forEach((track) => track.stop());
            }
            setPrimaryCameraStream(null);
            setSessionData(null);
          }
        }}
        sessionData={sessionData}
        onSecurityConnected={handleSecuritySetupComplete}
      />
    </>
  );
};

// ✅ FIXED Security Camera Setup Modal - QR CODE ONLY
const SecurityCameraSetup = ({
  isOpen,
  onClose,
  sessionData,
  onSecurityConnected,
}) => {
  const [qrCodeDataURL, setQRCodeDataURL] = useState(null);
  const [isSecurityConnected, setIsSecurityConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("waiting");
  const [angleVerified, setAngleVerified] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // Generate QR Code
  const generateQRCode = async () => {
    if (!sessionData) return;

    const baseURL = window.location.origin;
    const securityURL = `${baseURL}/mobile-security?interviewId=${sessionData.interviewId}&userId=${sessionData.userId}`;

    try {
      const qrDataURL = await QRCode.toDataURL(securityURL, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      setQRCodeDataURL(qrDataURL);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  // ✅ Monitor for mobile security connection AND angle verification
  useEffect(() => {
    if (!isOpen || !sessionData) return;

    console.log("👀 Starting security camera connection detection...");

    let checkCount = 0;
    const maxChecks = 300; // 150 seconds (500ms * 300)

    const checkInterval = setInterval(() => {
      checkCount++;

      // Check mobile connection
      const mobileStatus = localStorage.getItem(
        `security_${sessionData.interviewId}`
      );

      // ✅ NEW: Check if angle is verified (90° angle)
      const angleStatus = localStorage.getItem(
        `security_angle_verified_${sessionData.interviewId}`
      );

      if (mobileStatus === "connected" && angleStatus === "true") {
        console.log("✅ Mobile security camera detected with correct angle!");
        setConnectionStatus("connected");
        setIsSecurityConnected(true);
        setAngleVerified(true);
        clearInterval(checkInterval);
        return;
      }

      if (mobileStatus === "connected" && !angleStatus) {
        console.log("⚠️ Camera connected but angle not verified yet...");
        setConnectionStatus("verifying_angle");
      }

      // Update attempt count
      setConnectionAttempts(checkCount);

      // Timeout after max checks
      if (checkCount >= maxChecks) {
        console.log("⏱️ Connection detection timeout");
        clearInterval(checkInterval);
      }
    }, 500);

    return () => {
      clearInterval(checkInterval);
    };
  }, [isOpen, sessionData]);

  useEffect(() => {
    if (isOpen && sessionData) {
      generateQRCode();
    }
  }, [isOpen, sessionData]);

  const handleContinue = () => {
    if (!isSecurityConnected || !angleVerified) {
      alert("Please wait for security camera to connect and verify 90° angle.");
      return;
    }

    console.log("📍 Continue button clicked");

    if (sessionData) {
      // Keep the connection signals for the interview page
      // localStorage.removeItem(`security_${sessionData.interviewId}`);
      // localStorage.removeItem(`security_angle_verified_${sessionData.interviewId}`);
    }

    if (onSecurityConnected) {
      console.log("📍 Calling onSecurityConnected callback...");
      onSecurityConnected();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔒 Security Camera Setup - MANDATORY"
      size="lg"
      closeOnOverlayClick={false}
    >
      <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6">
        {/* Mandatory Notice */}
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border-2 border-red-500 dark:border-red-700 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
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
              <h4 className="text-sm font-bold text-red-900 dark:text-red-300 mb-1">
                ⚠️ MANDATORY REQUIREMENT
              </h4>
              <p className="text-sm text-red-800 dark:text-red-200">
                You MUST connect a mobile security camera at 90° angle BEFORE
                starting the interview. This is NON-NEGOTIABLE.
              </p>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isSecurityConnected && angleVerified
                    ? "bg-green-500"
                    : connectionStatus === "verifying_angle"
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-amber-400 animate-pulse"
                }`}
              />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Security Camera Status:
              </span>
            </div>
            <span
              className={`text-sm font-semibold ${
                isSecurityConnected && angleVerified
                  ? "text-green-600 dark:text-green-400"
                  : connectionStatus === "verifying_angle"
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {isSecurityConnected && angleVerified
                ? "✓ Connected & Verified"
                : connectionStatus === "verifying_angle"
                  ? "Verifying 90° angle..."
                  : `Waiting... (${connectionAttempts}/300)`}
            </span>
          </div>

          {/* Angle Verification Status */}
          <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              90° Angle Verification:
            </span>
            <span
              className={`text-xs font-semibold ${
                angleVerified
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {angleVerified ? "✓ Verified" : "Pending"}
            </span>
          </div>

          {/* Progress bar */}
          {!isSecurityConnected && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(connectionAttempts / 300) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* QR Code Section */}
        <div className="p-6 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/30">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
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
              <h4 className="text-lg font-bold text-blue-900 dark:text-blue-300">
                Scan QR Code with Mobile Device
              </h4>
            </div>

            {qrCodeDataURL ? (
              <div className="flex justify-center my-4">
                <div className="inline-block p-4 bg-white rounded-xl shadow-lg">
                  <img
                    src={qrCodeDataURL}
                    alt="Security Camera QR Code"
                    className="w-64 h-64"
                  />
                </div>
              </div>
            ) : (
              <div className="w-64 h-64 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto my-4">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            )}

            <div className="space-y-2 text-left bg-white dark:bg-gray-900 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">
                📱 Setup Instructions:
              </h5>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 ml-4">
                <li>1. Open camera app on your mobile device</li>
                <li>2. Scan the QR code above</li>
                <li>3. Grant camera permissions when prompted</li>
                <li>
                  4. <strong>IMPORTANT:</strong> Position device at exactly 90°
                  angle from your laptop screen
                </li>
                <li>5. Follow on-screen angle calibration instructions</li>
                <li>6. Wait for "Connected & Verified" status above</li>
                <li>
                  7. Keep mobile device in this position during entire interview
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Critical Warning */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
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
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">
                ⚠️ Critical Requirements
              </h4>
              <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <li>• Camera MUST be at 90° angle (perpendicular to screen)</li>
                <li>
                  • Moving the camera during interview will TERMINATE the
                  session
                </li>
                <li>
                  • Closing the mobile security page will END the interview
                </li>
                <li>
                  • Angle verification is automatic - follow mobile instructions
                </li>
                <li>• You cannot proceed without proper setup</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button - Only enabled when connected AND angle verified */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          onClick={handleContinue}
          disabled={!isSecurityConnected || !angleVerified}
          className="w-full"
        >
          {isSecurityConnected && angleVerified ? (
            <>
              <svg
                className="w-5 h-5 mr-2"
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
              Continue to Interview
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 mr-2 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Waiting for Security Camera Connection...
            </>
          )}
        </Button>

        {!isSecurityConnected && (
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
            Please scan QR code and complete angle calibration
          </p>
        )}
      </div>
    </Modal>
  );
};

export default InterviewSettings;
