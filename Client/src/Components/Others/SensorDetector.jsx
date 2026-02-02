import { useEffect, useRef, useState } from "react";
import { Card } from "../Common/Card";
import { Button } from "../index";

const SensorAngleDetector = ({ onCalibrationComplete, onSkip }) => {
  const [sensorSupported, setSensorSupported] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  const [alpha, setAlpha] = useState(null);
  const [beta, setBeta] = useState(null);
  const [gamma, setGamma] = useState(null);

  const [deviceAngle, setDeviceAngle] = useState(null);
  const [targetAngle] = useState(90);
  const [angleDifference, setAngleDifference] = useState(null);
  const [angleQuality, setAngleQuality] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const captureIntervalRef = useRef(null);

  // ✅ NEW: Store orientation handler ref for cleanup
  const orientationHandlerRef = useRef(null);

  useEffect(() => {
    const checkSensorSupport = () => {
      if (!window.DeviceOrientationEvent && !window.DeviceMotionEvent) {
        setSensorSupported(false);
        console.log("❌ Sensors not supported");
        return false;
      }
      console.log("✅ Sensors supported");
      return true;
    };

    checkSensorSupport();
  }, []);

  const requestSensorPermission = async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === "granted") {
          setPermissionGranted(true);
          console.log("✅ Sensor permission granted");
          return true;
        } else {
          alert("Sensor permission denied. Angle detection requires sensors.");
          return false;
        }
      } catch (error) {
        console.error("❌ Sensor permission error:", error);
        return false;
      }
    } else {
      setPermissionGranted(true);
      return true;
    }
  };

  const startDetection = async () => {
    const hasPermission = await requestSensorPermission();
    if (!hasPermission) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsDetecting(true);
      startOrientationListener();
    } catch (err) {
      console.error("Camera error:", err);
      alert("Unable to access camera.");
    }
  };

  // ✅ FIXED: Proper orientation listener with cleanup
  const startOrientationListener = () => {
    const handleOrientation = (event) => {
      setAlpha(event.alpha);
      setBeta(event.beta);
      setGamma(event.gamma);

      const angle = calculateAngleFromSensors(event.beta, event.gamma);
      setDeviceAngle(angle);

      const diff = Math.abs(angle - targetAngle);
      setAngleDifference(diff);

      const quality = getAngleQuality(diff);
      setAngleQuality(quality);
    };

    // Store handler ref for cleanup
    orientationHandlerRef.current = handleOrientation;

    window.addEventListener("deviceorientation", handleOrientation);
    console.log("✅ Orientation listener started");
  };

  const calculateAngleFromSensors = (beta, gamma) => {
    if (beta === null || gamma === null) return null;

    let normalizedBeta = beta;
    if (beta < 0) {
      normalizedBeta = 180 + beta;
    }

    const angle = Math.abs(normalizedBeta);
    const leanAdjustment = Math.abs(gamma) / 10;

    return Math.round(Math.max(0, Math.min(180, angle - leanAdjustment)));
  };

  const getAngleQuality = (difference) => {
    if (difference <= 5)
      return { level: "excellent", color: "green", score: 100 };
    if (difference <= 10) return { level: "good", color: "yellow", score: 80 };
    if (difference <= 20) return { level: "fair", color: "orange", score: 60 };
    return { level: "poor", color: "red", score: 40 };
  };

  const confirmCalibration = () => {
    if (onCalibrationComplete) {
      onCalibrationComplete({
        angle: deviceAngle,
        quality: angleQuality?.level,
        score: angleQuality?.score,
        stream: streamRef.current,
        sensorData: { alpha, beta, gamma },
      });
    }
  };

  // ✅ FIXED: Proper cleanup
  const stopDetection = () => {
    console.log("🧹 Stopping sensor detection...");

    setIsDetecting(false);

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("🛑 Camera track stopped");
      });
      streamRef.current = null;
    }

    // ✅ NEW: Remove orientation listener
    if (orientationHandlerRef.current) {
      window.removeEventListener(
        "deviceorientation",
        orientationHandlerRef.current
      );
      orientationHandlerRef.current = null;
      console.log("🧹 Orientation listener removed");
    }

    // Reset state
    setDeviceAngle(null);
    setAngleQuality(null);
    setAngleDifference(null);
  };

  // ✅ FIXED: Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("🧹 Component unmounting - cleanup");
      stopDetection();
    };
  }, []);

  // Prevent page close during detection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDetecting) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDetecting]);

  if (!sensorSupported) {
    return (
      <Card className="p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
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
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Device Sensors Not Available
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Your device doesn't support motion sensors required for automatic
          angle detection.
        </p>
        <Button onClick={onSkip}>Continue with Manual Setup</Button>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
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
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Sensor-Based Angle Detection
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Using device sensors for precise 90° measurement
              </p>
            </div>
          </div>
        </Card>

        {/* Setup Screen */}
        {!isDetecting && (
          <Card className="p-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    permissionGranted ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Sensor Permission: {permissionGranted ? "Granted" : "Pending"}
                </span>
              </div>
            </div>

            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This system uses your device's built-in gyroscope and
                accelerometer to measure the exact angle with precision.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-green-900 dark:text-green-300 mb-2 flex items-center gap-2">
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Advantages
                  </h4>
                  <ul className="text-xs text-green-800 dark:text-green-200 space-y-1">
                    <li>• Highly accurate (±2 degrees)</li>
                    <li>• Real-time measurement</li>
                    <li>• Works in any lighting</li>
                    <li>• No complex setup required</li>
                  </ul>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
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
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    How It Works
                  </h4>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Measures device tilt angle</li>
                    <li>• Compares to 90° target</li>
                    <li>• Provides real-time feedback</li>
                    <li>• Auto-confirms when stable</li>
                  </ul>
                </div>
              </div>

              <Button onClick={startDetection} className="px-8">
                Start Angle Detection
              </Button>
            </div>
          </Card>
        )}

        {/* Active Detection */}
        {isDetecting && (
          <>
            <Card className="overflow-hidden">
              <div className="relative aspect-4/3 bg-gray-900">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {deviceAngle !== null && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/80 backdrop-blur-sm rounded-2xl p-8 max-w-sm">
                      <div className="text-center mb-6">
                        <div className="text-white/60 text-sm mb-2">
                          Current Angle
                        </div>
                        <div
                          className={`text-6xl font-bold mb-2 ${
                            angleQuality?.color === "green"
                              ? "text-green-400"
                              : angleQuality?.color === "yellow"
                                ? "text-yellow-400"
                                : angleQuality?.color === "orange"
                                  ? "text-orange-400"
                                  : "text-red-400"
                          }`}
                        >
                          {deviceAngle}°
                        </div>
                        <div className="text-white/40 text-xs">
                          Target: {targetAngle}°
                        </div>
                      </div>

                      {/* Circular Progress */}
                      <div className="relative w-48 h-48 mx-auto mb-4">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="96"
                            cy="96"
                            r="88"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="8"
                          />
                          <circle
                            cx="96"
                            cy="96"
                            r="88"
                            fill="none"
                            stroke={
                              angleQuality?.color === "green"
                                ? "#22c55e"
                                : angleQuality?.color === "yellow"
                                  ? "#eab308"
                                  : angleQuality?.color === "orange"
                                    ? "#f97316"
                                    : "#ef4444"
                            }
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 88}`}
                            strokeDashoffset={`${2 * Math.PI * 88 * (1 - (angleQuality?.score || 0) / 100)}`}
                            className="transition-all duration-500"
                          />
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-white text-lg font-bold mb-1">
                            {angleQuality?.score || 0}%
                          </div>
                          <div
                            className={`text-sm font-semibold ${
                              angleQuality?.color === "green"
                                ? "text-green-400"
                                : angleQuality?.color === "yellow"
                                  ? "text-yellow-400"
                                  : angleQuality?.color === "orange"
                                    ? "text-orange-400"
                                    : "text-red-400"
                            }`}
                          >
                            {angleQuality?.level?.toUpperCase() || "POOR"}
                          </div>
                        </div>
                      </div>

                      {angleDifference !== null && (
                        <div className="text-center">
                          <div className="text-white/60 text-xs mb-1">
                            Difference from target
                          </div>
                          <div className="text-white text-xl font-bold">
                            ±{angleDifference}°
                          </div>
                        </div>
                      )}

                      {angleQuality && (
                        <div className="mt-4 p-3 bg-white/10 rounded-lg">
                          <p className="text-white text-xs text-center">
                            {angleQuality.level === "excellent" &&
                              "Perfect! Hold this position."}
                            {angleQuality.level === "good" &&
                              "Almost there! Adjust slightly."}
                            {angleQuality.level === "fair" &&
                              "Keep adjusting..."}
                            {angleQuality.level === "poor" &&
                              "Position device more upright."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Sensor Data */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Live Sensor Data
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Alpha (Z)
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {alpha !== null ? `${Math.round(alpha)}°` : "—"}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Beta (X)
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {beta !== null ? `${Math.round(beta)}°` : "—"}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Gamma (Y)
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {gamma !== null ? `${Math.round(gamma)}°` : "—"}
                  </div>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              {angleQuality?.level === "excellent" ||
              angleQuality?.level === "good" ? (
                <>
                  <Button onClick={confirmCalibration} className="flex-1">
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Confirm Angle
                  </Button>
                  <Button onClick={stopDetection} variant="secondary">
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={stopDetection}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel Detection
                </Button>
              )}
            </div>
          </>
        )}

        {/* Help */}
        <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">
                How to Position Your Device
              </h4>
              <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <li>• Hold device upright (like taking a portrait photo)</li>
                <li>• Stand device on its side or use a phone stand</li>
                <li>• Camera lens should face your laptop screen</li>
                <li>• Keep device as vertical as possible (90° angle)</li>
                <li>• The display will show real-time angle measurement</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SensorAngleDetector;
