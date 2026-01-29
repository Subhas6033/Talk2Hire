import { useEffect, useRef, useState } from "react";
import { Modal, Button } from "../index";

const CameraCheck = ({ isOpen, onClose, onSuccess }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stoppedRef = useRef(false);

  const [status, setStatus] = useState("idle"); // idle | checking | success | failed
  const [error, setError] = useState("");

  const startCameraTest = async () => {
    setStatus("checking");
    setError("");
    stoppedRef.current = false;

    try {
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

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // If stream is active → success
      setStatus("success");
    } catch (err) {
      console.error("Camera error:", err);
      setStatus("failed");
      setError("Camera access denied or camera not available.");
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleStartInterview = () => {
    if (streamRef.current && onSuccess) {
      // Pass the stream to parent component
      onSuccess(streamRef.current);
      // Don't stop the stream here - parent will manage it
      streamRef.current = null; // Remove our reference
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCameraTest();
    }

    return () => {
      // Only stop camera if we still own the stream
      if (streamRef.current) {
        stopCamera();
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
