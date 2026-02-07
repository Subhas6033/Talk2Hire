import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Card } from "../Common/Card";
import { Button } from "../index";

const SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin;

const MobileSecurityCamera = () => {
  const [searchParams] = useSearchParams();
  const interviewId = searchParams.get("interviewId");
  const userId = searchParams.get("userId");

  console.log("🔧 Socket URL:", SOCKET_URL);
  console.log("📋 Interview ID:", interviewId);
  console.log("👤 User ID:", userId);

  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const captureIntervalRef = useRef(null);

  // Device orientation refs
  const [alpha, setAlpha] = useState(null);
  const [beta, setBeta] = useState(null);
  const [gamma, setGamma] = useState(null);
  const orientationHandlerRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [framesSent, setFramesSent] = useState(0);

  // ✅ COMMENTED: Angle verification states (temporarily disabled)
  // const [showAngleCalibration, setShowAngleCalibration] = useState(true);
  const [showAngleCalibration, setShowAngleCalibration] = useState(false); // Disabled for now
  const [currentAngle, setCurrentAngle] = useState(90); // Default angle
  // const [angleVerified, setAngleVerified] = useState(false);
  const [angleVerified, setAngleVerified] = useState(true); // Auto-verified for now
  const [angleQuality, setAngleQuality] = useState({
    level: "excellent",
    color: "green",
    score: 100,
  });
  const [calibrationAttempts, setCalibrationAttempts] = useState(0);
  const TARGET_ANGLE = 90;

  useEffect(() => {
    if (!interviewId || !userId) {
      setError("Invalid interview session. Please scan the QR code again.");
      return;
    }

    // Connect to socket
    const socket = io(SOCKET_URL, {
      query: {
        interviewId,
        userId,
        type: "security_camera",
      },
      transports: ["websocket", "polling"], // Try websocket first, fallback to polling
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    console.log("🔌 Attempting socket connection to:", SOCKET_URL);

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Security camera connected to server");
      setIsConnected(true);

      // If camera is already streaming, emit the connection event
      if (isStreaming) {
        socket.emit("security_camera_connected", {
          interviewId,
          userId,
          angle: currentAngle,
          angleQuality: angleQuality?.level,
          timestamp: Date.now(),
        });
        console.log(
          "✅ Re-emitted security_camera_connected after socket reconnection",
        );
      }
    });

    socket.on("disconnect", () => {
      console.log("⚠️ Security camera disconnected");
      setIsConnected(false);
      localStorage.removeItem(`security_${interviewId}`);
      localStorage.removeItem(`security_angle_verified_${interviewId}`);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err);
      console.log("Trying to connect to:", SOCKET_URL);
      setError(`Connection error: ${err.message}. Camera will still work.`);
    });

    socket.on("error", (err) => {
      console.error("❌ Socket error:", err);
      setError(err.message || "Socket error occurred");
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setError(null);
    });

    return () => {
      socket.disconnect();
      localStorage.removeItem(`security_${interviewId}`);
      localStorage.removeItem(`security_angle_verified_${interviewId}`);
    };
  }, [interviewId, userId]);

  // ✅ Start camera automatically when component mounts (don't wait for socket)
  useEffect(() => {
    if (interviewId && userId && !isStreaming) {
      // Start camera immediately, don't wait for socket connection
      const timer = setTimeout(() => {
        startCamera();
      }, 500); // Small delay to ensure component is mounted

      return () => clearTimeout(timer);
    }
  }, [interviewId, userId]);

  /* ========================================
     COMMENTED OUT: ANGLE VERIFICATION CODE
     ======================================== */

  // ✅ COMMENTED: Request device orientation permission
  /*
  const requestSensorPermission = async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === "granted") {
          console.log("✅ Sensor permission granted");
          return true;
        } else {
          setError(
            "Sensor permission denied. Angle detection requires device sensors.",
          );
          return false;
        }
      } catch (error) {
        console.error("❌ Sensor permission error:", error);
        setError("Unable to request sensor permission.");
        return false;
      }
    } else {
      // Sensors available without explicit permission
      return true;
    }
  };
  */

  // ✅ COMMENTED: Calculate angle from device sensors
  /*
  const calculateAngleFromSensors = (betaVal, gammaVal) => {
    if (betaVal === null || gammaVal === null) return null;

    // Beta represents tilt front-to-back (X-axis rotation)
    // For 90° positioning, we want beta close to 90 (device upright)
    let normalizedBeta = betaVal;

    // Adjust for negative values
    if (betaVal < 0) {
      normalizedBeta = 180 + betaVal;
    }

    const angle = Math.abs(normalizedBeta);

    // Account for device lean (gamma = side-to-side tilt)
    const leanAdjustment = Math.abs(gammaVal) / 10;

    return Math.round(Math.max(0, Math.min(180, angle - leanAdjustment)));
  };
  */

  // ✅ COMMENTED: Get angle quality assessment
  /*
  const getAngleQuality = (angle) => {
    const difference = Math.abs(angle - TARGET_ANGLE);

    if (difference <= 5)
      return { level: "excellent", color: "green", score: 100 };
    if (difference <= 10) return { level: "good", color: "yellow", score: 80 };
    if (difference <= 20) return { level: "fair", color: "orange", score: 60 };
    return { level: "poor", color: "red", score: 40 };
  };
  */

  // ✅ COMMENTED: Start orientation monitoring
  /*
  const startOrientationListener = () => {
    const handleOrientation = (event) => {
      setAlpha(event.alpha);
      setBeta(event.beta);
      setGamma(event.gamma);

      const angle = calculateAngleFromSensors(event.beta, event.gamma);
      setCurrentAngle(angle);

      if (angle !== null) {
        const quality = getAngleQuality(angle);
        setAngleQuality(quality);

        // Auto-verify if excellent for 3 seconds
        if (quality.level === "excellent" && !angleVerified) {
          setTimeout(() => {
            if (angleQuality?.level === "excellent") {
              verifyAngle();
            }
          }, 3000);
        }
      }
    };

    orientationHandlerRef.current = handleOrientation;
    window.addEventListener("deviceorientation", handleOrientation);
    console.log("✅ Orientation listener started");
  };
  */

  // ✅ COMMENTED: Verify angle and proceed
  /*
  const verifyAngle = () => {
    if (!currentAngle || !angleQuality) {
      alert("Please position your device first.");
      return;
    }

    if (angleQuality.level !== "excellent" && angleQuality.level !== "good") {
      const proceed = window.confirm(
        `Angle quality is ${angleQuality.level} (${currentAngle}°). For best results, aim for 85-95 degrees. Proceed anyway?`,
      );
      if (!proceed) return;
    }

    console.log(`✅ Angle verified: ${currentAngle}° (${angleQuality.level})`);
    setAngleVerified(true);
    setShowAngleCalibration(false);

    // Signal angle verification
    localStorage.setItem(`security_angle_verified_${interviewId}`, "true");

    // Now start camera
    startCamera();
  };
  */

  // ✅ COMMENTED: Start angle calibration
  /*
  const beginCalibration = async () => {
    const hasPermission = await requestSensorPermission();
    if (!hasPermission) return;

    setCalibrationAttempts((prev) => prev + 1);
    startOrientationListener();
  };
  */

  /* ========================================
     END OF COMMENTED ANGLE VERIFICATION CODE
     ======================================== */

  // ✅ MODIFIED: Start camera immediately (no angle verification required)
  const startCamera = async () => {
    // Prevent multiple camera starts
    if (streamRef.current || isStreaming) {
      console.log("⚠️ Camera already started, skipping...");
      return;
    }

    try {
      console.log("📱 Starting camera...");

      // Request rear camera (environment facing)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch((err) => {
            console.error("❌ Video play error:", err);
          });
        };
      }

      setIsStreaming(true);
      startCapture();

      // Signal connection
      localStorage.setItem(`security_${interviewId}`, "connected");
      localStorage.setItem(`security_angle_verified_${interviewId}`, "true"); // Auto-set for now

      // Emit socket event (if connected)
      if (socketRef.current?.connected) {
        socketRef.current.emit("security_camera_connected", {
          interviewId,
          userId,
          angle: currentAngle,
          angleQuality: angleQuality?.level,
          timestamp: Date.now(),
        });
        console.log("✅ Socket event sent: security_camera_connected");
      } else {
        console.log("⚠️ Socket not connected yet, will emit when connected");
      }

      console.log("✅ Camera started successfully");
    } catch (err) {
      console.error("❌ Camera error:", err);

      // Provide more specific error messages
      let errorMessage = "Unable to access camera. ";
      if (err.name === "NotAllowedError") {
        errorMessage += "Please grant camera permissions and refresh the page.";
      } else if (err.name === "NotFoundError") {
        errorMessage += "No camera found on this device.";
      } else if (err.name === "NotReadableError") {
        errorMessage += "Camera is already in use by another application.";
      } else {
        errorMessage += err.message || "Unknown error occurred.";
      }

      setError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }

    // Clear signals
    localStorage.removeItem(`security_${interviewId}`);
    localStorage.removeItem(`security_angle_verified_${interviewId}`);

    // Emit disconnect
    if (socketRef.current?.connected) {
      socketRef.current.emit("security_camera_disconnected", {
        interviewId,
        userId,
        timestamp: Date.now(),
      });
    }

    setIsStreaming(false);
    console.log("🛑 Camera stopped");
  };

  const captureAndSendFrame = () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !socketRef.current?.connected
    ) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result;

            socketRef.current.emit("security_frame", {
              interviewId,
              userId,
              frame: base64data,
              timestamp: Date.now(),
              currentAngle: currentAngle, // Send current angle with frame
            });

            setFramesSent((prev) => prev + 1);
          };
          reader.readAsDataURL(blob);
        }
      },
      "image/jpeg",
      0.7,
    );
  };

  const startCapture = () => {
    captureIntervalRef.current = setInterval(() => {
      captureAndSendFrame();
    }, 2000);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera();

      // Remove orientation listener (if enabled)
      if (orientationHandlerRef.current) {
        window.removeEventListener(
          "deviceorientation",
          orientationHandlerRef.current,
        );
        orientationHandlerRef.current = null;
      }
    };
  }, []);

  // Prevent page close during monitoring
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isStreaming) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isStreaming]);

  // ✅ COMMENTED: Angle calibration screen (not shown anymore)
  /*
  if (showAngleCalibration && !angleVerified) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        ... angle calibration UI ...
      </div>
    );
  }
  */

  // Main camera monitoring UI (shown immediately)
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
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
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Security Camera Active
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Monitoring in progress
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
                  }`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Server: {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isStreaming ? "bg-green-500 animate-pulse" : "bg-gray-400"
                  }`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Camera: {isStreaming ? "Monitoring" : "Inactive"}
                </span>
              </div>
              {isStreaming && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Frames: {framesSent}
                </span>
              )}
            </div>
          </div>
        </Card>

        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0"
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
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="relative aspect-4/3 bg-gray-900">
            {isStreaming ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  onCanPlay={(e) => {
                    console.log("✅ Video can play - starting playback");
                    e.target
                      .play()
                      .catch((err) => console.error("Play error:", err));
                  }}
                />
                <canvas ref={canvasRef} className="hidden" />

                <div className="absolute top-4 left-4">
                  <div className="flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-sm rounded-md">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-white">
                      MONITORING
                    </span>
                  </div>
                </div>

                <div className="absolute top-4 right-4">
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-600/90 backdrop-blur-sm rounded-md">
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-xs font-medium text-white">
                      CONNECTED
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <svg
                    className="w-16 h-16 mx-auto text-gray-600 mb-4"
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
                  <p className="text-sm text-gray-400">
                    Camera initializing...
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {isStreaming && (
          <div className="flex gap-3">
            <Button onClick={stopCamera} variant="secondary" className="flex-1">
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
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
              Stop Monitoring (Ends Interview)
            </Button>
          </div>
        )}

        <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex gap-2">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0"
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
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>WARNING:</strong> Keep device steady and positioned to
              view your screen. Closing this page will automatically terminate
              the interview. Do not lock your phone.
            </p>
          </div>
        </Card>

        {isStreaming && (
          <Card className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0"
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
                  Security Camera Operational!
                </p>
                <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                  You can now return to the main interview page on your laptop.
                  Keep this page open and device steady.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MobileSecurityCamera;
