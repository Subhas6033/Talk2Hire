import { useEffect, useRef, useState } from "react";
import { Card } from "../Common/Card";
import { Button } from "../index";

const CameraAngleCalibrator = ({ onCalibrationComplete, onSkip }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraStream, setCameraStream] = useState(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0); // 0: not started, 1: laptop detection, 2: angle verification

  // Detected features
  const [detectedLaptop, setDetectedLaptop] = useState(null);
  const [estimatedAngle, setEstimatedAngle] = useState(null);
  const [angleQuality, setAngleQuality] = useState(null); // poor, fair, good, excellent
  const [calibrationScore, setCalibrationScore] = useState(0);

  // Visual feedback
  const [landmarks, setLandmarks] = useState([]);
  const [frameAnalysis, setFrameAnalysis] = useState(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCalibration = async () => {
    try {
      // Request rear camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCalibrating(true);
      setCalibrationStep(1);
      startAngleDetection();
    } catch (err) {
      console.error("Camera error:", err);
      alert("Unable to access camera. Please grant camera permissions.");
    }
  };

  const startAngleDetection = () => {
    const interval = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;

      const analysis = analyzeFrame();
      if (analysis) {
        setFrameAnalysis(analysis);
        updateCalibrationFeedback(analysis);
      }
    }, 500); // Analyze every 500ms

    // Store interval for cleanup
    return () => clearInterval(interval);
  };

  /**
   * Analyze video frame to detect laptop and estimate angle
   */
  const analyzeFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return null;
    }

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Perform analysis
    const analysis = {
      laptopDetected: false,
      laptopBounds: null,
      screenArea: null,
      aspectRatio: null,
      estimatedAngle: null,
      confidence: 0,
      edgeStrength: 0,
    };

    // Edge detection for laptop screen
    const edges = detectEdges(imageData);

    // Find rectangular screen
    const screenRect = findLaptopScreen(edges, canvas.width, canvas.height);

    if (screenRect) {
      analysis.laptopDetected = true;
      analysis.laptopBounds = screenRect;

      // Calculate aspect ratio and angle
      const { angle, confidence } = estimateAngleFromRect(
        screenRect,
        canvas.width,
        canvas.height
      );
      analysis.estimatedAngle = angle;
      analysis.confidence = confidence;
      analysis.aspectRatio = screenRect.width / screenRect.height;
    }

    return analysis;
  };

  /**
   * Simple edge detection using Sobel-like operator
   */
  const detectEdges = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const edges = new Uint8ClampedArray(width * height);

    // Convert to grayscale and detect edges
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        // Grayscale
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        // Simple gradient (Sobel approximation)
        const idx_left = (y * width + (x - 1)) * 4;
        const idx_right = (y * width + (x + 1)) * 4;
        const idx_up = ((y - 1) * width + x) * 4;
        const idx_down = ((y + 1) * width + x) * 4;

        const gray_left =
          (data[idx_left] + data[idx_left + 1] + data[idx_left + 2]) / 3;
        const gray_right =
          (data[idx_right] + data[idx_right + 1] + data[idx_right + 2]) / 3;
        const gray_up =
          (data[idx_up] + data[idx_up + 1] + data[idx_up + 2]) / 3;
        const gray_down =
          (data[idx_down] + data[idx_down + 1] + data[idx_down + 2]) / 3;

        const gx = gray_right - gray_left;
        const gy = gray_down - gray_up;
        const magnitude = Math.sqrt(gx * gx + gy * gy);

        edges[y * width + x] = magnitude > 50 ? 255 : 0;
      }
    }

    return edges;
  };

  /**
   * Find laptop screen rectangle from edges
   */
  const findLaptopScreen = (edges, width, height) => {
    // Look for bright rectangular region (screen)
    // This is a simplified version - in production, use OpenCV.js or TensorFlow.js

    let maxArea = 0;
    let bestRect = null;

    // Scan for large rectangular regions
    const blockSize = 50;
    for (let y = 0; y < height - blockSize; y += blockSize) {
      for (let x = 0; x < width - blockSize; x += blockSize) {
        let edgeCount = 0;

        // Count edges in perimeter
        for (let i = 0; i < blockSize; i++) {
          // Top and bottom edges
          edgeCount += edges[y * width + x + i] > 0 ? 1 : 0;
          edgeCount += edges[(y + blockSize) * width + x + i] > 0 ? 1 : 0;

          // Left and right edges
          edgeCount += edges[(y + i) * width + x] > 0 ? 1 : 0;
          edgeCount += edges[(y + i) * width + (x + blockSize)] > 0 ? 1 : 0;
        }

        // If strong edge perimeter, likely a rectangle
        if (edgeCount > blockSize * 2) {
          const area = blockSize * blockSize;
          if (area > maxArea) {
            maxArea = area;
            bestRect = { x, y, width: blockSize, height: blockSize };
          }
        }
      }
    }

    return bestRect;
  };

  /**
   * Estimate camera angle from detected laptop screen
   *
   * Theory: When viewing a laptop at 90°, the screen appears as a tall rectangle.
   * At 0° (from front), it appears wide. We use aspect ratio to estimate angle.
   */
  const estimateAngleFromRect = (rect, frameWidth, frameHeight) => {
    const aspectRatio = rect.width / rect.height;

    // Normalized position (center of frame = 0.5, 0.5)
    const centerX = (rect.x + rect.width / 2) / frameWidth;
    const centerY = (rect.y + rect.height / 2) / frameHeight;

    // Calculate angle based on aspect ratio
    // AspectRatio ≈ 1.0 → viewing from side (90°)
    // AspectRatio ≈ 2.0 → viewing from front (0°)
    // This is a simplified model

    let angle;
    let confidence;

    if (aspectRatio < 0.8) {
      // Very tall → likely 90° side view
      angle = 85 + (0.8 - aspectRatio) * 50;
      confidence = 0.9;
    } else if (aspectRatio < 1.2) {
      // Near square → good 90° angle
      angle = 90 - Math.abs(1.0 - aspectRatio) * 50;
      confidence = 0.95;
    } else if (aspectRatio < 1.8) {
      // Getting wider → angled view
      angle = 70 - (aspectRatio - 1.2) * 50;
      confidence = 0.7;
    } else {
      // Very wide → front view
      angle = 45 - (aspectRatio - 1.8) * 30;
      confidence = 0.5;
    }

    // Adjust confidence based on position (centered is better)
    const positionScore =
      1 - (Math.abs(centerX - 0.5) + Math.abs(centerY - 0.5));
    confidence *= positionScore;

    return { angle: Math.max(0, Math.min(90, angle)), confidence };
  };

  /**
   * Update visual feedback based on analysis
   */
  const updateCalibrationFeedback = (analysis) => {
    if (!analysis.laptopDetected) {
      setDetectedLaptop(null);
      setEstimatedAngle(null);
      setAngleQuality(null);
      return;
    }

    setDetectedLaptop(analysis.laptopBounds);
    setEstimatedAngle(Math.round(analysis.estimatedAngle));

    // Determine quality based on angle
    const angle = analysis.estimatedAngle;
    let quality;
    let score = 0;

    if (angle >= 85 && angle <= 95) {
      quality = "excellent";
      score = 100;
    } else if ((angle >= 80 && angle < 85) || (angle > 95 && angle <= 100)) {
      quality = "good";
      score = 80;
    } else if ((angle >= 70 && angle < 80) || (angle > 100 && angle <= 110)) {
      quality = "fair";
      score = 60;
    } else {
      quality = "poor";
      score = 40;
    }

    setAngleQuality(quality);
    setCalibrationScore(score);

    // Auto-advance if excellent for 3 seconds
    if (quality === "excellent") {
      setTimeout(() => {
        if (angleQuality === "excellent") {
          setCalibrationStep(2);
        }
      }, 3000);
    }
  };

  /**
   * Draw visual overlay on canvas
   */
  const drawOverlay = () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Clear previous overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw detected laptop bounds
    if (detectedLaptop) {
      ctx.strokeStyle =
        angleQuality === "excellent"
          ? "#22c55e"
          : angleQuality === "good"
            ? "#eab308"
            : "#ef4444";
      ctx.lineWidth = 4;
      ctx.strokeRect(
        detectedLaptop.x,
        detectedLaptop.y,
        detectedLaptop.width,
        detectedLaptop.height
      );
    }

    // Draw center crosshair
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 20, centerY);
    ctx.lineTo(centerX + 20, centerY);
    ctx.moveTo(centerX, centerY - 20);
    ctx.lineTo(centerX, centerY + 20);
    ctx.stroke();
  };

  useEffect(() => {
    if (isCalibrating) {
      const interval = setInterval(drawOverlay, 100);
      return () => clearInterval(interval);
    }
  }, [isCalibrating, detectedLaptop, angleQuality]);

  const confirmCalibration = () => {
    if (onCalibrationComplete) {
      onCalibrationComplete({
        angle: estimatedAngle,
        quality: angleQuality,
        score: calibrationScore,
        stream: cameraStream,
      });
    }
  };

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
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Camera Angle Calibration
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Position camera at 90° from laptop screen
              </p>
            </div>
          </div>

          {/* Calibration Steps */}
          <div className="flex items-center gap-2 mb-4">
            {[1, 2].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 rounded-full ${
                  calibrationStep >= step
                    ? "bg-indigo-600"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {calibrationStep === 0 && "Click 'Start Calibration' to begin"}
            {calibrationStep === 1 &&
              "Position camera to view laptop from the side"}
            {calibrationStep === 2 &&
              "Calibration complete! Confirm to continue"}
          </p>
        </Card>

        {/* Camera View */}
        {!isCalibrating ? (
          <Card className="p-8 text-center">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto">
                <svg
                  className="w-10 h-10 text-indigo-600 dark:text-indigo-400"
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Perfect 90° Angle Setup
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This calibration ensures your security camera is positioned
                  correctly at a 90-degree angle from your laptop screen.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="w-8 h-8 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      1
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Position Device
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Place mobile device or camera perpendicular to your laptop
                    screen
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="w-8 h-8 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      2
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Frame Laptop
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Ensure laptop screen is visible and centered in camera view
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="w-8 h-8 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      3
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Auto-Detect
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    System will automatically detect and verify 90° angle
                  </p>
                </div>
              </div>

              <Button onClick={startCalibration} className="px-8">
                Start Calibration
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="relative aspect-4/3 bg-gray-900">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {/* Angle Feedback Overlay */}
              {estimatedAngle !== null && (
                <div className="absolute top-4 left-4 right-4">
                  <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-medium">
                        Detected Angle
                      </span>
                      <span className="text-white text-2xl font-bold">
                        {estimatedAngle}°
                      </span>
                    </div>

                    {/* Angle Meter */}
                    <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden mb-2">
                      <div
                        className={`absolute left-0 top-0 h-full transition-all duration-300 ${
                          angleQuality === "excellent"
                            ? "bg-green-500"
                            : angleQuality === "good"
                              ? "bg-yellow-500"
                              : angleQuality === "fair"
                                ? "bg-orange-500"
                                : "bg-red-500"
                        }`}
                        style={{ width: `${calibrationScore}%` }}
                      />
                      {/* Target marker at 90° */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-white"
                        style={{ left: "50%" }}
                      />
                    </div>

                    {/* Quality Indicator */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          angleQuality === "excellent"
                            ? "text-green-400"
                            : angleQuality === "good"
                              ? "text-yellow-400"
                              : angleQuality === "fair"
                                ? "text-orange-400"
                                : "text-red-400"
                        }`}
                      >
                        {angleQuality?.toUpperCase()}
                      </span>
                      {angleQuality === "excellent" && (
                        <span className="text-xs text-white">
                          Hold steady...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Instructions Overlay */}
              {!detectedLaptop && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 max-w-sm text-center">
                    <svg
                      className="w-12 h-12 mx-auto mb-3 text-white animate-pulse"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <p className="text-white text-sm font-medium">
                      Looking for laptop screen...
                    </p>
                    <p className="text-white/70 text-xs mt-2">
                      Point camera at your laptop from the side
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        {isCalibrating && (
          <div className="flex gap-3">
            {calibrationStep === 2 ||
            angleQuality === "excellent" ||
            angleQuality === "good" ? (
              <>
                <Button
                  onClick={confirmCalibration}
                  className="flex-1"
                  disabled={!angleQuality}
                >
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
                  Confirm Calibration
                </Button>
                <Button
                  onClick={() => {
                    setCalibrationStep(1);
                    setEstimatedAngle(null);
                    setAngleQuality(null);
                  }}
                  variant="secondary"
                >
                  Retry
                </Button>
              </>
            ) : (
              <Button onClick={onSkip} variant="secondary" className="flex-1">
                Skip Calibration (Not Recommended)
              </Button>
            )}
          </div>
        )}

        {/* Help Section */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
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
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                Tips for Best Results
              </h4>
              <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <li>
                  • Camera should view laptop screen from the side
                  (perpendicular)
                </li>
                <li>
                  • Laptop screen should appear narrow/vertical in camera view
                </li>
                <li>• Keep camera steady during detection</li>
                <li>• Ensure good lighting for better detection</li>
                <li>• Target angle: 85-95 degrees for optimal monitoring</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CameraAngleCalibrator;
