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
        video: { facingMode: "user" },
      });

      if (stoppedRef.current) return;

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // If stream is active → success
      setStatus("success");
    } catch (err) {
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

  useEffect(() => {
    if (isOpen) {
      startCameraTest();
    }

    return () => {
      stopCamera();
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
        <div className="w-full h-56 bg-black/60 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

        {status === "checking" && (
          <p className="text-sm text-white/70">Checking camera access…</p>
        )}

        {status === "success" && (
          <>
            <p className="text-green-600 font-medium">
              Camera is working properly ✅
            </p>

            <Button onClick={onSuccess}>Start Interview</Button>
          </>
        )}

        {status === "failed" && (
          <>
            <p className="text-red-500 text-center">{error}</p>

            <Button variant="secondary" onClick={startCameraTest}>
              Try Again
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default CameraCheck;
