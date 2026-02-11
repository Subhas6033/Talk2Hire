import { useEffect, useRef, useState } from "react";
import { HolisticLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const useHolisticDetection = (videoElement, socket, isEnabled = true) => {
  const holisticLandmarkerRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [detectionData, setDetectionData] = useState({
    faceLandmarks: null,
    poseLandmarks: null,
    leftHandLandmarks: null,
    rightHandLandmarks: null,
  });
  const lastVideoTimeRef = useRef(-1);

  // Initialize MediaPipe Holistic Landmarker
  useEffect(() => {
    let mounted = true;

    const initializeHolisticLandmarker = async () => {
      try {
        console.log("🔧 Initializing MediaPipe Holistic Landmarker...");

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        if (!mounted) return;

        const landmarker = await HolisticLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minFaceDetectionConfidence: 0.5,
          minFaceSuppressionThreshold: 0.3,
          minFacePresenceConfidence: 0.5,
          minPoseDetectionConfidence: 0.5,
          minPoseSuppressionThreshold: 0.3,
          minPosePresenceConfidence: 0.5,
          minHandLandmarksConfidence: 0.5,
        });

        if (!mounted) return;

        holisticLandmarkerRef.current = landmarker;
        setIsInitialized(true);
        console.log("✅ MediaPipe Holistic Landmarker initialized");
      } catch (error) {
        console.error("❌ Failed to initialize holistic detection:", error);
      }
    };

    initializeHolisticLandmarker();

    return () => {
      mounted = false;
      if (holisticLandmarkerRef.current) {
        holisticLandmarkerRef.current.close();
        holisticLandmarkerRef.current = null;
      }
    };
  }, []);

  // Start/Stop Detection Loop
  useEffect(() => {
    if (
      !isEnabled ||
      !isInitialized ||
      !holisticLandmarkerRef.current ||
      !videoElement ||
      !socket
    ) {
      return;
    }

    console.log("👁️ Starting holistic detection loop...");

    const detectHolistic = async () => {
      try {
        if (!videoElement || !holisticLandmarkerRef.current) return;

        // Only process new frames
        if (videoElement.currentTime === lastVideoTimeRef.current) {
          return;
        }

        lastVideoTimeRef.current = videoElement.currentTime;

        // Detect holistic landmarks
        const timestamp = performance.now();
        const result = holisticLandmarkerRef.current.detectForVideo(
          videoElement,
          timestamp,
        );

        const data = {
          faceLandmarks:
            result.faceLandmarks.length > 0 ? result.faceLandmarks[0] : null,
          poseLandmarks:
            result.poseLandmarks.length > 0 ? result.poseLandmarks[0] : null,
          leftHandLandmarks:
            result.leftHandLandmarks.length > 0
              ? result.leftHandLandmarks[0]
              : null,
          rightHandLandmarks:
            result.rightHandLandmarks.length > 0
              ? result.rightHandLandmarks[0]
              : null,
        };

        setDetectionData(data);

        // Send result to server
        if (socket.connected) {
          socket.emit("holistic_detection_result", {
            hasFace: data.faceLandmarks !== null,
            hasPose: data.poseLandmarks !== null,
            hasLeftHand: data.leftHandLandmarks !== null,
            hasRightHand: data.rightHandLandmarks !== null,
            faceCount: result.faceLandmarks.length,
            timestamp: Date.now(),
            // Optionally send landmark data (be careful with data size)
            // landmarks: data,
          });
        }
      } catch (error) {
        console.error("❌ Holistic detection error:", error);
      }
    };

    // Run detection every frame (using requestAnimationFrame)
    let animationFrameId;

    const detectionLoop = () => {
      detectHolistic();
      animationFrameId = requestAnimationFrame(detectionLoop);
    };

    detectionLoop();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      console.log("🛑 Holistic detection loop stopped");
    };
  }, [isEnabled, isInitialized, videoElement, socket]);

  return {
    detectionData,
    isInitialized,
    hasFace: detectionData.faceLandmarks !== null,
    hasPose: detectionData.poseLandmarks !== null,
    hasLeftHand: detectionData.leftHandLandmarks !== null,
    hasRightHand: detectionData.rightHandLandmarks !== null,
  };
};

export default useHolisticDetection;
