import { useEffect, useRef, useState, useCallback } from "react";
import { HolisticLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Run ML inference at ~3fps — enough for violation detection, cheap on CPU
const DETECTION_INTERVAL_MS = 300;

const SOCKET_EMIT_INTERVAL_MS = 1000;

const useHolisticDetection = (videoRef, socketRef, isEnabled = true) => {
  const holisticLandmarkerRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const lastSocketEmitRef = useRef(0);
  const lastResultRef = useRef(null);
  const isDetectingRef = useRef(false);

  const [isInitialized, setIsInitialized] = useState(false);
  const [detectionData, setDetectionData] = useState({
    faceLandmarks: null,
    poseLandmarks: null,
    leftHandLandmarks: null,
    rightHandLandmarks: null,
  });

  // ── 1. Initialize MediaPipe once on mount ───────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
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

    init();

    return () => {
      mounted = false;
      if (holisticLandmarkerRef.current) {
        holisticLandmarkerRef.current.close();
        holisticLandmarkerRef.current = null;
      }
    };
  }, []); // runs once — no deps needed

  // ── 2. Smart socket emitter — only emits on change or heartbeat ─────────
  const emitToSocket = useCallback(
    (payload) => {
      // Always read .current so we get the live socket even if it connected
      // after this callback was created
      const socket = socketRef?.current;
      if (!socket?.connected) return;

      const now = Date.now();
      const last = lastResultRef.current;

      const changed =
        !last ||
        last.faceCount !== payload.faceCount ||
        last.hasFace !== payload.hasFace ||
        last.hasPose !== payload.hasPose;

      const heartbeatDue =
        now - lastSocketEmitRef.current >= SOCKET_EMIT_INTERVAL_MS;

      if (changed || heartbeatDue) {
        socket.emit("holistic_detection_result", payload);
        lastSocketEmitRef.current = now;
        lastResultRef.current = payload;
      }
    },
    [socketRef], // socketRef object is stable — this never re-creates
  );

  // ── 3. Single detection tick
  const runDetection = useCallback(() => {
    // Always read .current here — captures the live element even if it
    // mounted after the interval started
    const videoElement = videoRef?.current;

    if (
      isDetectingRef.current ||
      !videoElement ||
      !holisticLandmarkerRef.current ||
      videoElement.readyState < 2 || // HAVE_CURRENT_DATA
      videoElement.paused
    ) {
      return;
    }

    isDetectingRef.current = true;

    try {
      const timestamp = performance.now();
      const result = holisticLandmarkerRef.current.detectForVideo(
        videoElement,
        timestamp,
      );

      const faceCount = result.faceLandmarks.length;

      const data = {
        faceLandmarks: faceCount > 0 ? result.faceLandmarks[0] : null,
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

      // Only re-render React state when faceCount actually changed
      const prev = lastResultRef.current;
      if (!prev || prev.faceCount !== faceCount) {
        setDetectionData(data);
      }

      emitToSocket({
        hasFace: faceCount > 0,
        hasPose: data.poseLandmarks !== null,
        hasLeftHand: data.leftHandLandmarks !== null,
        hasRightHand: data.rightHandLandmarks !== null,
        faceCount,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("❌ Holistic detection error:", error);
    } finally {
      isDetectingRef.current = false;
    }
  }, [videoRef, emitToSocket]); // refs are stable — this rarely re-creates

  // ── 4. Start / stop the interval ─────────────────────────────────────────
  useEffect(() => {
    if (!isEnabled || !isInitialized) {
      return;
    }

    console.log(
      `👁️ Starting holistic detection (${DETECTION_INTERVAL_MS}ms interval)`,
    );

    // setInterval instead of requestAnimationFrame: decoupled from the paint
    // cycle, so audio processing callbacks get uncontested CPU time between
    // detection ticks.
    detectionTimerRef.current = setInterval(
      runDetection,
      DETECTION_INTERVAL_MS,
    );

    return () => {
      if (detectionTimerRef.current) {
        clearInterval(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
      isDetectingRef.current = false;
      console.log("🛑 Holistic detection stopped");
    };
  }, [isEnabled, isInitialized, runDetection]);

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
