import { useState, useEffect, useRef } from "react";
import { Modal } from "../index";
import { Button } from "../index";

const CameraCheck = ({
  isOpen,
  onClose,
  onSuccess,
  facingMode = "environment", // ✅ NEW: "environment" (back) or "user" (front)
  title = "Camera Setup", // ✅ NEW: Customizable title
  description = "Please allow camera access to continue with the interview.", // ✅ NEW: Customizable description
}) => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef(null);
  const streamHandedOffRef = useRef(false);

  const requestCamera = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`📹 Requesting ${facingMode} camera...`);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            console.error("❌ Video play error:", err);
          });
        };
      }

      console.log(`✅ ${facingMode} camera access granted`);
    } catch (err) {
      console.error(`❌ ${facingMode} camera access error:`, err);

      let errorMessage = "Unable to access camera. ";
      if (err.name === "NotAllowedError") {
        errorMessage += "Please grant camera permissions.";
      } else if (err.name === "NotFoundError") {
        errorMessage += `No ${facingMode === "user" ? "front" : "back"} camera found on this device.`;
      } else if (err.name === "NotReadableError") {
        errorMessage += "Camera is in use by another application.";
      } else {
        errorMessage += err.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (stream) {
      console.log(`✅ Passing ${facingMode} camera stream to parent`);
      streamHandedOffRef.current = true;
      onSuccess(stream);
      // Don't close modal or stop stream here - parent will handle it
    }
  };

  const handleClose = () => {
    // ✅ FIXED: Only stop stream if it wasn't handed off to parent
    if (stream && !streamHandedOffRef.current) {
      console.log(`🛑 Stopping ${facingMode} camera stream`);
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    } else if (streamHandedOffRef.current) {
      console.log(`✅ Stream handed off to parent, not stopping`);
    }
    setError(null);
    streamHandedOffRef.current = false; // Reset for next time
    onClose();
  };

  useEffect(() => {
    if (isOpen && !stream && !isLoading) {
      requestCamera();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (stream && !streamHandedOffRef.current) {
        console.log(`🧹 Cleanup: Stopping ${facingMode} camera stream`);
        stream.getTracks().forEach((track) => track.stop());
      } else if (streamHandedOffRef.current) {
        console.log(`✅ Cleanup: Stream was handed off, not stopping`);
      }
    };
  }, [stream, facingMode]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="lg">
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>

        <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center">
                <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-4" />
                <p className="text-sm text-white">Accessing camera...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center px-6">
                <svg
                  className="w-12 h-12 text-red-500 mx-auto mb-4"
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
                <p className="text-sm text-white mb-4">{error}</p>
                <Button onClick={requestCamera} variant="secondary" size="sm">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />

          {stream && !error && (
            <div className="absolute top-3 left-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-600/90 backdrop-blur-sm rounded-lg shadow-xl">
                <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                <span className="text-xs font-bold text-white">
                  CAMERA ACTIVE
                </span>
              </div>
            </div>
          )}
        </div>

        {stream && !error && (
          <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5"
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
                  {facingMode === "user" ? "Front" : "Back"} Camera Ready
                </p>
                <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                  Your camera is working properly. Click continue to proceed.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button onClick={handleClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={!stream || !!error}>
            Continue
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CameraCheck;
