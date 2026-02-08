import { useEffect, useRef, useState } from "react";
import { Modal, Button } from "../index";

const CameraCheck = ({ isOpen, onClose, onSuccess }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stoppedRef = useRef(false);
  const streamTransferredRef = useRef(false);

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const startCameraTest = async () => {
    setStatus("checking");
    setError("");
    stoppedRef.current = false;
    streamTransferredRef.current = false;

    try {
      console.log("📹 Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (stoppedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      console.log("✅ Camera access granted");
      console.log("📹 Stream details:", {
        id: stream.id,
        active: stream.active,
        tracks: stream.getTracks().map((t) => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
          settings: t.getSettings(),
        })),
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = async () => {
          console.log("✅ Video metadata loaded in CameraCheck");
          try {
            await videoRef.current.play();
            console.log("✅ Video preview playing");
          } catch (err) {
            console.error("❌ Preview play error:", err);
          }
        };
      }

      setStatus("success");
    } catch (err) {
      console.error("❌ Camera error:", err);
      setStatus("failed");
      setError("Camera access denied or camera not available.");
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;

    if (streamRef.current) {
      console.log("🛑 Stopping camera in CameraCheck");
      streamRef.current.getTracks().forEach((t) => {
        console.log(`🛑 Stopping track: ${t.kind} (${t.label})`);
        t.stop();
      });
      streamRef.current = null;
    }
  };

  const handleStartInterview = () => {
    if (!streamRef.current) {
      console.error("❌ No stream to transfer!");
      alert("Camera stream not available. Please try again.");
      return;
    }

    // ✅ CRITICAL: Verify stream is active before transfer
    const videoTrack = streamRef.current.getVideoTracks()[0];

    console.log("📹 Verifying stream before transfer:", {
      streamActive: streamRef.current.active,
      trackExists: !!videoTrack,
      trackState: videoTrack?.readyState,
      trackEnabled: videoTrack?.enabled,
    });

    if (!streamRef.current.active) {
      console.error("❌ Stream is not active!");
      alert("Camera stream is not active. Please try again.");
      return;
    }

    if (!videoTrack || videoTrack.readyState !== "live") {
      console.error("❌ Video track is not live!");
      alert("Camera is not ready. Please try again.");
      return;
    }

    console.log("✅ Stream verified - transferring to parent");
    console.log("📹 Transferring camera stream to parent");

    // Mark that we've transferred the stream
    streamTransferredRef.current = true;

    // Pass the stream to parent component
    if (onSuccess) {
      onSuccess(streamRef.current);
    }

    // Remove our reference but DON'T stop the stream
    streamRef.current = null;
  };

  useEffect(() => {
    if (isOpen) {
      startCameraTest();
    }

    return () => {
      console.log("🧹 CameraCheck cleanup", {
        hasStream: !!streamRef.current,
        transferred: streamTransferredRef.current,
      });

      // ✅ CRITICAL: Only stop camera if we still own it AND it wasn't transferred
      if (streamRef.current && !streamTransferredRef.current) {
        console.log("🛑 Stopping camera stream in cleanup (not transferred)");
        stopCamera();
      } else if (streamTransferredRef.current) {
        console.log("✅ Stream transferred - not stopping in cleanup");
      }

      setStatus("idle");
      setError("");
    };
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Camera Check"
      size="md"
      footer={null}
    >
      <div className="space-y-6 text-center">
        {/* Video Preview */}
        <div className="w-full h-64 bg-black/60 rounded-lg overflow-hidden relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
            style={{ transform: "scaleX(-1)" }}
          />
          {status === "checking" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm">Accessing camera...</p>
              </div>
            </div>
          )}
        </div>

        {status === "checking" && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please allow camera access when prompted
          </p>
        )}

        {status === "success" && (
          <>
            <p className="text-green-600 dark:text-green-400 font-medium">
              ✅ Camera is working properly
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your camera will be visible during the interview
            </p>

            <Button onClick={handleStartInterview} className="w-full">
              Start Interview
            </Button>
          </>
        )}

        {status === "failed" && (
          <>
            <p className="text-red-500 text-center font-medium">{error}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Make sure you've granted camera permissions in your browser
            </p>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={startCameraTest}
                className="flex-1"
              >
                Try Again
              </Button>
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default CameraCheck;
