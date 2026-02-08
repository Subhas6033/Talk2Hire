import { useEffect, useRef, useState } from "react";
import { Card } from "../Common/Card";
import { Button } from "../index";

const SecurityMonitor = ({
  interviewId,
  userId,
  onWarning,
  securityStream,
  setSecurityStream,
  isVisible,
  onToggleVisibility,
  readOnly = false, // ✅ NEW: Read-only mode when security is already connected via QR
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState("idle");

  // Detection state
  const [phoneDetected, setPhoneDetected] = useState(false);

  // ✅ NEW: Check for existing connection on mount
  useEffect(() => {
    const checkExistingConnection = () => {
      const mobileConnected = localStorage.getItem(`security_${interviewId}`);
      const angleVerified = localStorage.getItem(
        `security_angle_verified_${interviewId}`,
      );

      if (mobileConnected === "connected" && angleVerified === "true") {
        console.log("✅ Security camera already connected (QR setup)");
        setIsConnected(true);
        setConnectionMethod("mobile");
        setShowInstructions(false);
        setDetectionStatus("active");
      }
    };

    if (interviewId && readOnly) {
      checkExistingConnection();
    }
  }, [interviewId, readOnly]);

  useEffect(() => {
    if (videoRef.current && securityStream) {
      videoRef.current.srcObject = securityStream;
      videoRef.current.play().catch((err) => {
        console.error("❌ Error playing security video:", err);
      });
    }
  }, [securityStream]);

  // Request security camera access (only if not read-only)
  const requestSecurityCamera = async (preferredFacing = "environment") => {
    if (readOnly) {
      console.log("⚠️ Security camera is in read-only mode");
      return;
    }

    try {
      console.log("📱 Requesting security camera access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: preferredFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setSecurityStream(stream);
      setIsConnected(true);
      setConnectionMethod(
        preferredFacing === "environment" ? "mobile" : "external",
      );
      setShowInstructions(false);
      startDetection();

      console.log("✅ Security camera connected");
    } catch (error) {
      console.error("❌ Security camera error:", error);

      if (preferredFacing === "environment") {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          setSecurityStream(fallbackStream);
          setIsConnected(true);
          setConnectionMethod("external");
          setShowInstructions(false);
          startDetection();
        } catch (fallbackError) {
          alert(
            "Unable to access security camera. Please ensure camera permissions are granted.",
          );
        }
      } else {
        alert(
          "Unable to access security camera. Please ensure camera permissions are granted.",
        );
      }
    }
  };

  // Simple motion detection
  const detectMotion = (videoElement, canvas) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    return imageData;
  };

  // Analyze frame for suspicious activity
  const analyzeFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const imageData = detectMotion(video, canvasRef.current);
    if (!imageData) return;

    const data = imageData.data;
    let totalBrightness = 0;
    let darkPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      totalBrightness += brightness;
      if (brightness < 50) darkPixels++;
    }

    const avgBrightness = totalBrightness / (data.length / 4);
    const darkRatio = darkPixels / (data.length / 4);

    // Detect suspicious patterns
    if (darkRatio > 0.7) {
      onWarning({
        type: "ABSENCE_DETECTED",
        message: "Candidate may have left the frame",
        severity: "high",
      });
    }

    if (avgBrightness > 200) {
      setPhoneDetected(true);
      onWarning({
        type: "BRIGHT_OBJECT_DETECTED",
        message: "Bright object (possibly phone/screen) detected",
        severity: "medium",
      });
    } else {
      setPhoneDetected(false);
    }
  };

  const startDetection = () => {
    setDetectionStatus("active");
    detectionIntervalRef.current = setInterval(() => {
      analyzeFrame();
    }, 2000);
  };

  const stopDetection = () => {
    setDetectionStatus("idle");
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopDetection();
      if (securityStream) {
        securityStream.getTracks().forEach((track) => track.stop());
      }
      if (interviewId) {
        localStorage.removeItem(`security_local_${interviewId}`);
      }
    };
  }, [securityStream, interviewId]);

  const generateMobileConnectionURL = () => {
    const baseURL = window.location.origin;
    return `${baseURL}/mobile-security?interviewId=${interviewId}&userId=${userId}`;
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={onToggleVisibility}
          className="rounded-full p-3 shadow-lg"
          title="Show Security Monitor"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </Button>
      </div>
    );
  }

  return (
    <Card className="flex flex-col overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Security Monitor
            </h3>
            {readOnly && (
              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                Active
              </span>
            )}
          </div>
          <button
            onClick={onToggleVisibility}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 bg-white dark:bg-gray-900">
        {/* ✅ MODIFIED: Show status when read-only */}
        {readOnly && isConnected ? (
          <div className="space-y-4">
            {/* Status Display */}
            <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-5 h-5 text-green-600 dark:text-green-400"
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
                <h4 className="text-sm font-semibold text-green-900 dark:text-green-300">
                  Security Camera Active
                </h4>
              </div>
              <p className="text-xs text-green-800 dark:text-green-200">
                Mobile security camera is connected and monitoring at 90° angle.
              </p>
            </div>

            {/* Detection Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Detection
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Active
                </p>
              </div>
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Source
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Mobile
                </p>
              </div>
            </div>
          </div>
        ) : !isConnected ? (
          // Setup Instructions (only if not read-only)
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                {readOnly
                  ? "Security Camera Not Connected"
                  : "Setup Security Camera"}
              </h4>
              <p className="text-xs text-blue-800 dark:text-blue-200">
                {readOnly
                  ? "Security camera must be connected via QR code during setup."
                  : "Position a mobile device or external camera at approximately 90° angle from your screen for security monitoring."}
              </p>
            </div>

            {!readOnly && (
              <>
                <div className="space-y-2">
                  <Button
                    onClick={() => requestSecurityCamera("environment")}
                    className="w-full text-sm py-2"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
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
                    Connect Mobile Camera
                  </Button>

                  <Button
                    onClick={() => requestSecurityCamera("user")}
                    variant="secondary"
                    className="w-full text-sm py-2"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Connect External Camera
                  </Button>
                </div>

                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    <strong>Alternative:</strong> Scan this URL on your mobile
                    device to connect:
                  </p>
                  <div className="mt-2 p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                    <code className="text-xs text-gray-800 dark:text-gray-200 break-all">
                      {generateMobileConnectionURL()}
                    </code>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          // Active Monitoring (with video feed if available)
          <div className="space-y-4">
            {securityStream && (
              <div className="relative w-full aspect-4/3 bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                <div className="absolute top-3 left-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-md">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        detectionStatus === "active"
                          ? "bg-green-500 animate-pulse"
                          : "bg-gray-500"
                      }`}
                    />
                    <span className="text-xs font-medium text-white">
                      {detectionStatus === "active" ? "MONITORING" : "IDLE"}
                    </span>
                  </div>
                </div>

                {phoneDetected && (
                  <div className="absolute top-3 right-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600/90 backdrop-blur-sm rounded-md">
                      <svg
                        className="w-4 h-4 text-white"
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
                      <span className="text-xs font-medium text-white">
                        ALERT
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Detection
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {detectionStatus === "active" ? "Active" : "Inactive"}
                </p>
              </div>
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Source
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {connectionMethod === "mobile" ? "Mobile" : "External"}
                </p>
              </div>
            </div>

            {!readOnly && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (securityStream) {
                      securityStream
                        .getTracks()
                        .forEach((track) => track.stop());
                    }
                    setSecurityStream(null);
                    setIsConnected(false);
                    stopDetection();
                    if (interviewId) {
                      localStorage.removeItem(`security_local_${interviewId}`);
                    }
                  }}
                  variant="secondary"
                  className="flex-1 text-xs py-2"
                >
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-start gap-2">
          <svg
            className="w-4 h-4 text-gray-400 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {readOnly
              ? "Security camera is monitoring your interview session"
              : "Security camera monitors for unauthorized activity during the interview"}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default SecurityMonitor;
