import { useEffect, useState, useRef } from "react";
import { Modal, Button } from "../index";
import { useNavigate } from "react-router-dom";

const REQUIRED_SECONDS = 2;
const MAX_WINDOW_SECONDS = 5;
const THRESHOLD = 0.03;

const MicrophoneCheck = ({ isOpen, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle"); // idle | checking | success | failed
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [spokenSeconds, setSpokenSeconds] = useState(0);

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const stoppedRef = useRef(false);

  const startMicTest = async () => {
    setStatus("checking");
    setError("");
    setSpokenSeconds(0);
    stoppedRef.current = false;
    startTimeRef.current = null;
    lastFrameTimeRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.fftSize);

      const analyze = (time) => {
        if (stoppedRef.current) return;

        if (!startTimeRef.current) {
          startTimeRef.current = time;
          lastFrameTimeRef.current = time;
        }

        const delta = (time - lastFrameTimeRef.current) / 1000;
        lastFrameTimeRef.current = time;
        const elapsed = (time - startTimeRef.current) / 1000;

        if (elapsed >= MAX_WINDOW_SECONDS) {
          setStatus("failed");
          setError("No sufficient speech detected. Redirecting to home...");
          stopMic();
          setTimeout(() => {
            onClose?.();
            navigate("/");
          }, 1500);
          return;
        }

        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }

        const rms = Math.sqrt(sum / dataArray.length);
        setLevel(rms);

        if (rms > THRESHOLD) {
          setSpokenSeconds((prev) => {
            const next = prev + delta;
            if (next >= REQUIRED_SECONDS) {
              setStatus("success");
              stopMic();
            }
            return next;
          });
        }

        rafRef.current = requestAnimationFrame(analyze);
      };

      rafRef.current = requestAnimationFrame(analyze);
    } catch (err) {
      setStatus("failed");
      setError("Microphone access denied.");
      stopMic();
    }
  };

  const stopMic = () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;

    rafRef.current && cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const ctx = audioContextRef.current;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});

    audioContextRef.current = null;
    analyserRef.current = null;
  };

  useEffect(() => {
    if (isOpen) startMicTest();

    return () => {
      stopMic();
      setStatus("idle");
      setError("");
      setLevel(0);
      setSpokenSeconds(0);
    };
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Microphone Check"
      size="md"
      footer={null}
    >
      <div className="space-y-6 text-center">
        {status === "checking" && (
          <>
            <p className="text-lg">
              Speak for at least{" "}
              <span className="font-semibold">{REQUIRED_SECONDS}</span> seconds
              within first {MAX_WINDOW_SECONDS} seconds
            </p>

            <p className="text-sm text-white/70">
              Spoken: {spokenSeconds.toFixed(1)} / {REQUIRED_SECONDS}s
            </p>

            {/* Voice Bars */}
            <div className="flex justify-center items-end gap-1 h-16">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 rounded-full bg-purple-500 transition-all"
                  style={{ height: `${Math.min(100, level * 3000)}%` }}
                />
              ))}
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <p className="text-green-600 font-medium">
              Microphone test passed ✅
            </p>
            <Button onClick={onSuccess}>Continue</Button>
          </>
        )}

        {status === "failed" && <p className="text-red-500">{error}</p>}
      </div>
    </Modal>
  );
};

export default MicrophoneCheck;
