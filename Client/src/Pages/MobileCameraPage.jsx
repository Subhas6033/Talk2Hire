import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import useSecondaryCamera from "../Hooks/useSecondaryCameraHook";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

const MobileCameraPage = () => {
  const [searchParams] = useSearchParams();
  const isMobile = searchParams.get("mobile") === "true";
  const sessionId = searchParams.get("session");
  const userId = searchParams.get("userId");

  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);

  const socketRef = useRef(null);
  const videoRef = useRef(null);

  const secondaryCamera = useSecondaryCamera(sessionId, userId, socketRef);

  // Initialize socket connection
  useEffect(() => {
    if (!isMobile || !sessionId || !userId) {
      setError("Invalid mobile camera link. Please scan the QR code again.");
      return;
    }

    console.log("📱 Initializing mobile secondary camera:", {
      sessionId,
      userId,
    });

    // Create socket connection
    const socket = io(SOCKET_URL, {
      query: { interviewId: sessionId, userId },
      transports: ["websocket", "polling"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Mobile socket connected:", socket.id);
      setIsConnected(true);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Mobile socket connection error:", err);
      setError(
        "Failed to connect to server. Please check your internet connection.",
      );
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Mobile socket disconnected:", reason);
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [isMobile, sessionId, userId]);

  // Request camera permission and start recording
  useEffect(() => {
    if (!isConnected || cameraGranted) return;

    const requestCamera = async () => {
      try {
        console.log("📱 Requesting front camera permission...");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user", // Front camera
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        console.log("✅ Front camera granted");
        setCameraGranted(true);

        // Show preview
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        // Emit connection event
        socketRef.current.emit("secondary_camera_connected", {
          interviewId: sessionId,
          userId,
          timestamp: Date.now(),
        });

        // Start recording
        await secondaryCamera.startRecording();
        console.log("✅ Mobile camera recording started");
      } catch (err) {
        console.error("❌ Camera permission denied:", err);

        let errorMessage = "Unable to access front camera. ";
        if (err.name === "NotAllowedError") {
          errorMessage +=
            "Please grant camera permission and refresh the page.";
        } else if (err.name === "NotFoundError") {
          errorMessage += "No front camera found on this device.";
        } else if (err.name === "NotReadableError") {
          errorMessage += "Camera is being used by another app.";
        } else {
          errorMessage += err.message;
        }

        setError(errorMessage);
      }
    };

    // Auto-request camera on mobile
    requestCamera();
  }, [isConnected, cameraGranted, sessionId, userId, secondaryCamera]);

  // Setup video preview
  useEffect(() => {
    if (!videoRef.current || !secondaryCamera.secondaryCameraStream) return;

    console.log("📱 Setting up video preview");
    videoRef.current.srcObject = secondaryCamera.secondaryCameraStream;
  }, [secondaryCamera.secondaryCameraStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (secondaryCamera.isRecording) {
        secondaryCamera.stopRecording();
      }
      secondaryCamera.cleanup();
    };
  }, [secondaryCamera]);

  // If not mobile or missing params, show error
  if (!isMobile || !sessionId || !userId) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-6">
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Invalid Link
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This page must be accessed by scanning the QR code from your desktop
            interview session.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Please return to your desktop and scan the QR code displayed during
            interview setup.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-linear-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
            <svg
              className="w-8 h-8 text-white"
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
          <h1 className="text-2xl font-bold text-white mb-2">
            Secondary Camera
          </h1>
          <p className="text-gray-300 text-sm">
            Keep this page open during your interview
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/10 border-2 border-red-500 rounded-xl p-6 text-center">
            <svg
              className="w-12 h-12 text-red-500 mx-auto mb-3"
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
            <p className="text-red-300 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Camera Preview */}
        <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700">
          {/* Status Bar */}
          <div className="bg-linear-to-r from-orange-600 to-red-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {secondaryCamera.isRecording ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                    <span className="text-white font-bold text-sm">
                      RECORDING
                    </span>
                  </>
                ) : isConnected ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-yellow-300 animate-pulse" />
                    <span className="text-white font-bold text-sm">
                      STANDBY
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-white font-bold text-sm">
                      CONNECTING...
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isConnected && (
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Video Preview */}
          <div className="relative aspect-9/16 bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />

            {/* Overlay when not recording */}
            {!secondaryCamera.isRecording && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-orange-500 rounded-full mb-4" />
                <p className="text-white text-sm font-medium">
                  {!isConnected
                    ? "Connecting..."
                    : "Waiting for interview to start..."}
                </p>
              </div>
            )}

            {/* Recording Indicator */}
            {secondaryCamera.isRecording && (
              <div className="absolute top-4 left-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-red-600/90 backdrop-blur-sm rounded-lg shadow-xl">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-bold">REC</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Instructions */}
          <div className="bg-gray-750 px-6 py-4 border-t border-gray-700">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-400 shrink-0 mt-0.5"
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
              <div className="text-sm text-gray-300">
                <p className="font-semibold mb-1">Important:</p>
                <ul className="space-y-1 text-xs text-gray-400">
                  <li>• Keep your phone steady during the interview</li>
                  <li>• Don't lock your screen or switch apps</li>
                  <li>• Ensure good lighting on your face</li>
                  <li>• Keep this page open until interview ends</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-500"}`}
            />
            <span className="text-sm text-gray-300">
              {isConnected ? "Connected to interview session" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileCameraPage;
