import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { SkillsSelector } from "../index";
import { startInterview } from "../../API/interviewApi";
import { QRCodeCanvas } from "qrcode.react";
import { io } from "socket.io-client";
import { useStreams } from "../../Hooks/streamContext";
import { setAllStreams } from "../../Hooks/streamSingleton";
import { AnimatePresence, motion } from "motion/react";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

const IS_MOBILE =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
const SCREEN_SHARE_SUPPORTED =
  !IS_MOBILE && !!navigator.mediaDevices?.getDisplayMedia;

const MIC_REQUIRED_MS = 1000;
const MIC_SILENCE_TIMEOUT_MS = 3000; // show warning after 3s of silence

const quotes = [
  "Success usually comes to those who are too busy improving themselves to be distracted by doubt or fear.",
  "Discipline is choosing between what you want now and what you want most in the long run.",
  "Great developers are not defined by the languages they know, but by how they think and solve problems.",
  "Confidence is built through consistent effort, learning from mistakes, and refusing to quit when things get difficult.",
  "The best way to predict your future is to create it through action, persistence, and continuous self-improvement.",
  "Every expert was once a beginner who decided to keep practicing even when progress felt slow and frustrating.",
  "Technology changes rapidly, but the ability to adapt and learn will always remain your greatest competitive advantage.",
  "Clear communication is just as important as technical skill when working on real-world software projects.",
  "Challenges are opportunities in disguise, especially when they push you beyond your comfort zone.",
  "Success in interviews is not about memorizing answers, but about demonstrating clarity, confidence, and structured thinking.",
];

const getQuote = () => quotes[Math.floor(Math.random() * quotes.length)];

// ─── Sub-components (white theme) ────────────────────────────

const StatusIcon = ({ status }) => {
  if (status === true)
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
        <svg
          className="w-3.5 h-3.5 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    );
  if (["connecting", "waiting", "starting"].includes(status))
    return (
      <div className="w-6 h-6 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
        <div className="animate-spin w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full" />
      </div>
    );
  if (["skipped", "optional", "na"].includes(status))
    return (
      <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
        <svg
          className="w-3 h-3 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
    );
  return (
    <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 shrink-0" />
  );
};

const LiveBadge = ({ color = "green", label }) => {
  const colorMap = {
    green: "bg-emerald-500",
    orange: "bg-orange-500",
    violet: "bg-indigo-500",
  };
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 ${colorMap[color]} rounded-md`}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      <span className="text-white text-[10px] font-bold tracking-widest">
        {label}
      </span>
    </div>
  );
};

const Spinner = ({ size = "md", color = "indigo" }) => {
  const sizeMap = {
    sm: "w-3.5 h-3.5 border-2",
    md: "w-5 h-5 border-2",
    lg: "w-8 h-8 border-[3px]",
  };
  const colorMap = {
    indigo: "border-indigo-200 border-t-indigo-500",
    blue: "border-blue-200 border-t-blue-500",
    orange: "border-orange-200 border-t-orange-500",
  };
  return (
    <div
      className={`animate-spin rounded-full shrink-0 ${sizeMap[size]} ${colorMap[color]}`}
    />
  );
};

const STEPS = [
  { num: 1, label: "Skills", sub: "Choose your focus areas" },
  { num: 2, label: "Guidelines", sub: "Rules & expectations" },
  { num: 3, label: "Microphone", sub: "Audio verification" },
  { num: 4, label: "Camera", sub: "Video feed setup" },
  { num: 5, label: "Screen", sub: "Desktop capture" },
  { num: 6, label: "Mobile", sub: "Secondary angle" },
  { num: 7, label: "Launch", sub: "All checks passed" },
];

const StepHeaderIcon = ({ num }) => {
  const paths = {
    1: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    2: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    3: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
    4: "M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z",
    5: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    6: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
    7: "M13 10V3L4 14h7v7l9-11h-7z",
  };
  return (
    <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
      <svg
        className="w-5 h-5 text-indigo-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d={paths[num]}
        />
      </svg>
    </div>
  );
};

const ContinueBtn = ({ onClick, disabled = false, children, hint }) => (
  <div className="flex flex-wrap items-center gap-4 mt-7">
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2.5 px-7 h-11 rounded-xl font-semibold text-sm transition-all duration-200 ${
        disabled
          ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
          : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 cursor-pointer"
      }`}
    >
      {children}
      {!disabled && (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
      )}
    </button>
    {hint && !disabled && (
      <span className="text-gray-400 text-sm">
        or press{" "}
        <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-md text-gray-500 text-xs font-mono">
          {hint}
        </kbd>
      </span>
    )}
  </div>
);

const CheckRow = ({ children }) => (
  <div className="flex items-center gap-4 px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl">
    <div className="w-5 h-5 rounded-full border-2 border-indigo-500 bg-indigo-50 flex items-center justify-center shrink-0">
      <svg
        className="w-3 h-3 text-indigo-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          d="M5 13l4 4L19 7"
        />
      </svg>
    </div>
    <span className="text-gray-700 text-sm">{children}</span>
  </div>
);

const slideVariants = {
  initial: { opacity: 0, x: 48, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    x: -32,
    filter: "blur(4px)",
    transition: { duration: 0.2, ease: [0.55, 0, 1, 0.45] },
  },
};

// ─── Main Component ───────────────────────────────────────────
const InterviewSetup = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const streamsRef = useStreams();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("jobId");

  const { watch, setValue } = useForm({
    mode: "onChange",
    defaultValues: { skills: [] },
  });
  const skills = watch("skills");

  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsReady, setQuestionsReady] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [currentQuote, setCurrentQuote] = useState("");

  const [micStream, setMicStream] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micConfirmed, setMicConfirmed] = useState(false);
  const [micSilenceWarning, setMicSilenceWarning] = useState(false); // ← new
  const speakingStartRef = useRef(null);
  const lastSoundTimeRef = useRef(null); // ← new: tracks last time sound was detected
  const silenceTimerRef = useRef(null); // ← new: debounce timer for silence warning

  const [primaryCameraStream, setPrimaryCameraStream] = useState(null);
  const [primaryCameraError, setPrimaryCameraError] = useState(null);
  const [mobileCameraConnected, setMobileCameraConnected] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [screenShareError, setScreenShareError] = useState(null);
  const screenShareStreamRef = useRef(null);
  const [socketConnectionFailed, setSocketConnectionFailed] = useState(false);

  const [initProgress, setInitProgress] = useState({
    questions: false,
    socket: false,
    serverReady: false,
    audioRecording: "na",
    videoRecording: "na",
    screenRecording: "na",
    mobileRecording: "na",
  });
  const [initError, setInitError] = useState(null);

  const primaryVideoRef = useRef(null);
  const mobileCanvasRef = useRef(null);
  const micTestCleanupRef = useRef(false);
  const screenVideoRef = useRef(null);
  const settingsSocketRef = useRef(null);
  const interviewSocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const questionStartedRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const sessionDataRef = useRef(null);
  const questionsReadyRef = useRef(false);

  useEffect(() => {
    sessionDataRef.current = sessionData;
  }, [sessionData]);
  useEffect(() => {
    questionsReadyRef.current = questionsReady;
  }, [questionsReady]);

  const hasExistingSkills = user?.skill?.trim();
  const progressPct = Math.round(
    ((currentStep - 1) / (STEPS.length - 1)) * 100,
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Enter") return;
      if (error) return;
      if (currentStep === 1) handleStartSetup();
      else if (currentStep === 2) handleAcceptGuidelines();
      else if (currentStep === 3 && micConfirmed) handleMicSuccess();
      else if (currentStep === 4 && primaryCameraStream)
        handlePrimaryCameraSuccess();
      else if (currentStep === 5 && screenShareStream)
        handleScreenShareSuccess();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    currentStep,
    micConfirmed,
    primaryCameraStream,
    screenShareStream,
    error,
  ]); // eslint-disable-line

  const handleStartSetup = () => {
    if (!hasExistingSkills && (!skills || skills.length === 0)) {
      setError("Please select at least one skill.");
      return;
    }
    setError(null);
    setCurrentStep(2);
    if (!questionStartedRef.current) {
      questionStartedRef.current = true;
      setIsGeneratingQuestions(true);
      dispatch(
        startInterview({
          skills: !hasExistingSkills ? skills : undefined,
          jobId,
        }),
      )
        .unwrap()
        .then((res) => {
          if (!res?.sessionId) throw new Error("No session id");
          setSessionData({ interviewId: res.sessionId, userId: user.id });
          setQuestionsReady(true);
        })
        .catch(() => {
          setError(
            "Failed to generate questions. Please go back and try again.",
          );
          questionStartedRef.current = false;
          setCurrentStep(1);
        })
        .finally(() => setIsGeneratingQuestions(false));
    }
  };

  const handleAcceptGuidelines = () => {
    if (error || (!questionsReady && !isGeneratingQuestions)) {
      setError(
        "Questions failed to generate. Please go back to Step 1 and try again.",
      );
      return;
    }
    setError(null);
    setCurrentStep(3);
  };

  const handleMicSuccess = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    micTestCleanupRef.current = true;
    analyserRef.current = null;
    setError(null);
    setCurrentStep(4);
  };

  const handlePrimaryCameraSuccess = () => {
    setError(null);
    setCurrentStep(5);
    startScreenShareTest();
  };

  const handleScreenShareSuccess = () => {
    const isMicActive = micStream?.active;
    const isCameraActive = primaryCameraStream?.active;
    const isScreenActive = SCREEN_SHARE_SUPPORTED
      ? screenShareStream?.active
      : true;
    if (!isMicActive || !isCameraActive || !isScreenActive) {
      const missing = [];
      if (!isMicActive) missing.push("microphone");
      if (!isCameraActive) missing.push("camera");
      if (!isScreenActive) missing.push("screen share");
      setError(
        `Not active: ${missing.join(", ")}. Please configure them again.`,
      );
      return;
    }
    setError(null);
    setCurrentStep(6);
  };

  const handleMobileCameraSuccess = () => {
    setError(null);
    setCurrentStep(7);
  };

  const startMicTest = async () => {
    try {
      setIsMicTesting(true);
      setCurrentQuote(getQuote());
      setError(null);
      setMicSilenceWarning(false);
      micTestCleanupRef.current = false;
      lastSoundTimeRef.current = Date.now(); // initialise so the timer starts fresh

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setMicStream(stream);

      if (!audioContextRef.current)
        audioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
      const audioContext = audioContextRef.current;
      if (audioContext.state === "suspended") await audioContext.resume();

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current || micTestCleanupRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const next = Math.min(100, (avg / 128) * 100);
        setMicLevel(next);

        if (next > 10) {
          // Sound detected — reset silence tracking
          lastSoundTimeRef.current = Date.now();
          setMicSilenceWarning(false);
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }

          if (!speakingStartRef.current) speakingStartRef.current = Date.now();
          else if (Date.now() - speakingStartRef.current >= MIC_REQUIRED_MS)
            setMicConfirmed(true);
        } else {
          // Silence — start/check silence timer
          speakingStartRef.current = null;
          const silentFor =
            Date.now() - (lastSoundTimeRef.current || Date.now());
          if (
            silentFor >= MIC_SILENCE_TIMEOUT_MS &&
            !micTestCleanupRef.current
          ) {
            setMicSilenceWarning(true);
          } else if (!silenceTimerRef.current && !micTestCleanupRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (!micTestCleanupRef.current) setMicSilenceWarning(true);
            }, MIC_SILENCE_TIMEOUT_MS);
          }
        }

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      setError(`Microphone error: ${err.message}`);
      setIsMicTesting(false);
      micTestCleanupRef.current = true;
    }
  };

  const startPrimaryCameraTest = async () => {
    try {
      setPrimaryCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setPrimaryCameraStream(stream);
    } catch (_) {
      setPrimaryCameraError("Camera permission denied.");
    }
  };

  useEffect(() => {
    if (currentStep === 4) startPrimaryCameraTest();
  }, [currentStep]);

  useEffect(() => {
    if (primaryVideoRef.current && primaryCameraStream) {
      primaryVideoRef.current.srcObject = primaryCameraStream;
      primaryVideoRef.current.play().catch((e) => {
        if (e.name !== "AbortError") console.error(e);
      });
    }
  }, [primaryCameraStream]);

  const startScreenShareTest = async () => {
    if (!SCREEN_SHARE_SUPPORTED) return;
    try {
      setScreenShareError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setScreenShareStream(stream);
      screenShareStreamRef.current = stream;
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        setScreenShareStream(null);
        screenShareStreamRef.current = null;
        setScreenShareError(
          "Screen sharing was stopped. Please share your screen again.",
        );
      });
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        await screenVideoRef.current.play().catch((e) => {
          if (e.name !== "AbortError") console.error(e);
        });
      }
    } catch (err) {
      setScreenShareError(
        err.name === "NotAllowedError"
          ? "Screen share permission denied. Please allow access and try again."
          : "Screen share cancelled. Please try again.",
      );
    }
  };

  useEffect(() => {
    if (currentStep !== 6) return;
    setSocketConnectionFailed(false);
    setError(null);
    let socket = null;
    let cancelled = false;
    const connect = (session) => {
      if (cancelled) return;
      socket = io(SOCKET_URL, {
        query: {
          interviewId: session.interviewId,
          userId: session.userId,
          type: "settings",
        },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20_000,
      });
      settingsSocketRef.current = socket;
      socket.on("connect", () =>
        socket.emit("request_secondary_camera_status", {
          interviewId: session.interviewId,
        }),
      );
      socket.on("secondary_camera_ready", () => setMobileCameraConnected(true));
      socket.on("secondary_camera_status", (d) => {
        if (d.connected) setMobileCameraConnected(true);
      });
      socket.on("mobile_camera_frame", (d) => {
        if (!d?.frame || !mobileCanvasRef.current) return;
        const img = new Image();
        img.onload = () => {
          const ctx = mobileCanvasRef.current?.getContext("2d");
          if (ctx)
            ctx.drawImage(
              img,
              0,
              0,
              mobileCanvasRef.current.width,
              mobileCanvasRef.current.height,
            );
        };
        img.src = d.frame;
      });
      socket.on("connect_error", () => {
        setError("Failed to connect to server for mobile camera.");
        setSocketConnectionFailed(true);
      });
    };
    if (sessionDataRef.current) connect(sessionDataRef.current);
    else {
      const iv = setInterval(() => {
        if (sessionDataRef.current) {
          clearInterval(iv);
          connect(sessionDataRef.current);
        }
      }, 300);
    }
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 7) return;
    let mounted = true;
    let socket = null;
    const init = async () => {
      try {
        if (!sessionDataRef.current) {
          await new Promise((res, rej) => {
            if (sessionDataRef.current) return res();
            const t = setTimeout(
              () => rej(new Error("Session creation timed out.")),
              60000,
            );
            const iv = setInterval(() => {
              if (sessionDataRef.current) {
                clearTimeout(t);
                clearInterval(iv);
                res();
              }
            }, 300);
          });
        }
        const session = sessionDataRef.current;
        if (settingsSocketRef.current?.connected) {
          settingsSocketRef.current.disconnect();
          settingsSocketRef.current = null;
          await new Promise((r) => setTimeout(r, 200));
        }
        if (mounted) setInitProgress((p) => ({ ...p, socket: "connecting" }));
        socket = io(SOCKET_URL, {
          query: {
            interviewId: session.interviewId,
            userId: session.userId,
            type: "interview",
          },
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20_000,
        });
        interviewSocketRef.current = socket;
        await new Promise((res, rej) => {
          const t = setTimeout(
            () => rej(new Error("Socket connection timeout")),
            20000,
          );
          socket.once("connect", () => {
            clearTimeout(t);
            socket.emit("setup_mode", {
              setupInProgress: true,
              interviewId: session.interviewId,
              userId: session.userId,
            });
            socket.emit("request_secondary_camera_status", {
              interviewId: session.interviewId,
            });
            if (mounted) setInitProgress((p) => ({ ...p, socket: true }));
            res();
          });
          socket.once("connect_error", (e) => {
            clearTimeout(t);
            rej(e);
          });
        });
        socket.on("secondary_camera_ready", () => {
          if (mounted) setMobileCameraConnected(true);
        });
        socket.on("secondary_camera_status", (d) => {
          if (d.connected && mounted) setMobileCameraConnected(true);
        });
        if (mounted) setInitProgress((p) => ({ ...p, serverReady: "waiting" }));
        await new Promise((res, rej) => {
          const t = setTimeout(
            () => rej(new Error("Server ready timeout")),
            20000,
          );
          socket.once("server_ready", () => {
            clearTimeout(t);
            if (mounted) setInitProgress((p) => ({ ...p, serverReady: true }));
            res();
          });
        });
        if (!questionsReadyRef.current) {
          if (mounted) setInitProgress((p) => ({ ...p, questions: "waiting" }));
          await new Promise((res, rej) => {
            if (questionsReadyRef.current) return res();
            const t = setTimeout(
              () => rej(new Error("Question generation timed out.")),
              60000,
            );
            const iv = setInterval(() => {
              if (questionsReadyRef.current) {
                clearTimeout(t);
                clearInterval(iv);
                res();
              }
            }, 300);
          });
        }
        if (mounted) setInitProgress((p) => ({ ...p, questions: true }));
        if (mounted)
          setInitProgress((p) => ({
            ...p,
            audioRecording: true,
            videoRecording: true,
            screenRecording: SCREEN_SHARE_SUPPORTED ? true : "skipped",
            mobileRecording: mobileCameraConnected ? true : "skipped",
          }));
        await new Promise((r) => setTimeout(r, 400));
        const payload = {
          micStream,
          primaryCameraStream,
          screenShareStream: screenShareStreamRef.current,
          sessionData: session,
          preInitializedSocket: socket,
          preWarmSessionIds: {},
          preWarmComplete: {
            audio: true,
            primaryCamera: true,
            screenRecording: SCREEN_SHARE_SUPPORTED,
            secondaryCamera: mobileCameraConnected,
          },
        };
        setAllStreams(payload);
        Object.assign(streamsRef.current, payload);
        if (mounted) {
          hasNavigatedRef.current = true;
          navigate("/interview/live", { replace: true });
        }
      } catch (err) {
        if (mounted) {
          setInitError(err.message);
          hasNavigatedRef.current = false;
          if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
            interviewSocketRef.current = null;
          }
        }
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [
    currentStep,
    mobileCameraConnected,
    micStream,
    primaryCameraStream,
    navigate,
    streamsRef,
  ]);

  useEffect(() => {
    return () => {
      if (hasNavigatedRef.current) {
        settingsSocketRef.current?.disconnect();
        return;
      }
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (micStream) micStream.getTracks().forEach((t) => t.stop());
      if (primaryCameraStream)
        primaryCameraStream.getTracks().forEach((t) => t.stop());
      if (screenShareStream)
        screenShareStream.getTracks().forEach((t) => t.stop());
      settingsSocketRef.current?.disconnect();
      interviewSocketRef.current?.disconnect();
    };
  }, []); // eslint-disable-line

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex overflow-hidden bg-gray-50">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-gray-200 bg-white">
        <div className="px-5 py-6 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">
              Interview Setup
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-4 py-6 gap-0.5">
          {STEPS.map((step) => {
            const done = currentStep > step.num;
            const active = currentStep === step.num;
            return (
              <div
                key={step.num}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 ${
                  active ? "bg-indigo-50 border border-indigo-100" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-indigo-600 text-white ring-2 ring-indigo-200 ring-offset-2"
                        : "bg-gray-100 text-gray-400 border border-gray-200"
                  }`}
                >
                  {done ? (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.num
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-sm font-semibold leading-tight transition-colors ${
                      active
                        ? "text-indigo-700"
                        : done
                          ? "text-emerald-600"
                          : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span
                    className={`text-[11px] leading-tight mt-0.5 transition-colors ${
                      active ? "text-indigo-400" : "text-gray-400"
                    }`}
                  >
                    {step.sub}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-5 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs font-medium">
              Setup Progress
            </span>
            <span className="text-indigo-600 text-xs font-bold">
              {progressPct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3.5 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-gray-800 text-sm font-semibold">
              Interview Setup
            </span>
          </div>
          <div className="flex items-center gap-1">
            {STEPS.map((s) => (
              <div
                key={s.num}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentStep === s.num
                    ? "w-5 bg-indigo-500"
                    : currentStep > s.num
                      ? "w-2 bg-emerald-500"
                      : "w-2 bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex items-start sm:items-center px-5 sm:px-8 lg:px-14 xl:px-20 py-8">
            <div className="w-full max-w-4xl mx-auto">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  variants={slideVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {/* Step header */}
                  <div className="flex items-center gap-3.5 mb-6">
                    <StepHeaderIcon num={currentStep} />
                    <div>
                      <p className="text-gray-400 text-xs font-semibold tracking-[0.15em] uppercase mb-0.5">
                        Step {currentStep} of {STEPS.length}
                      </p>
                      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight tracking-tight">
                        {STEPS[currentStep - 1].label}
                      </h1>
                    </div>
                  </div>

                  {/* Generating banner */}
                  {currentStep > 1 &&
                    currentStep < 7 &&
                    isGeneratingQuestions && (
                      <div className="mb-4 flex items-center gap-2.5 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                        <Spinner size="sm" color="blue" />
                        <p className="text-blue-600 text-xs font-medium">
                          Generating questions in background — continue freely
                        </p>
                      </div>
                    )}
                  {currentStep > 1 &&
                    currentStep < 7 &&
                    questionsReady &&
                    !isGeneratingQuestions && (
                      <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <svg
                          className="w-3.5 h-3.5 text-emerald-600 shrink-0"
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
                        <p className="text-emerald-700 text-xs font-medium">
                          Questions ready
                        </p>
                      </div>
                    )}

                  {/* Global error */}
                  {error && (
                    <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                      <svg
                        className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}

                  {/* ── Step 1: Skills ── */}
                  {currentStep === 1 && (
                    <div>
                      <p className="text-gray-500 text-base leading-relaxed mb-5">
                        {hasExistingSkills
                          ? "Your interview will be tailored to your configured skills shown below."
                          : "Choose the areas you'd like to be interviewed on. These will shape your questions."}
                      </p>
                      {!hasExistingSkills ? (
                        <div className="w-full">
                          <SkillsSelector
                            selectedSkills={skills || []}
                            onSkillsChange={(s) =>
                              setValue("skills", s, { shouldValidate: true })
                            }
                          />
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {user.skill.split(",").map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 text-xs font-medium"
                            >
                              {skill.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                      <ContinueBtn
                        onClick={handleStartSetup}
                        disabled={
                          (!hasExistingSkills &&
                            (!skills || skills.length === 0)) ||
                          isGeneratingQuestions
                        }
                        hint="Enter"
                      >
                        {isGeneratingQuestions
                          ? "Generating…"
                          : "Complete & Continue"}
                      </ContinueBtn>
                    </div>
                  )}

                  {/* ── Step 2: Guidelines ── */}
                  {currentStep === 2 && (
                    <div>
                      <p className="text-gray-500 text-base leading-relaxed mb-5">
                        Please read and acknowledge the following before your
                        session begins.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {[
                          "Ensure you're in a quiet, well-lit environment",
                          "Keep your face fully visible in the camera at all times",
                          "Speak clearly and minimise background noise",
                          "Do not switch tabs or minimise the browser window",
                          "Answer questions naturally and honestly",
                        ].map((text, idx) => (
                          <CheckRow key={idx}>{text}</CheckRow>
                        ))}
                      </div>
                      <ContinueBtn
                        onClick={handleAcceptGuidelines}
                        disabled={
                          !!error || (!questionsReady && !isGeneratingQuestions)
                        }
                        hint="Enter"
                      >
                        Accept & Continue
                      </ContinueBtn>
                    </div>
                  )}

                  {/* ── Step 3: Microphone ── */}
                  {currentStep === 3 && (
                    <div className="max-w-2xl space-y-5">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                          Microphone Check
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                          Speak clearly for at least {MIC_REQUIRED_MS / 1000}{" "}
                          second to confirm your microphone is working.
                        </p>
                      </div>

                      {!isMicTesting ? (
                        <div className="space-y-5">
                          <div className="flex items-start gap-4 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                              <svg
                                className="w-5 h-5 text-indigo-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                />
                              </svg>
                            </div>
                            <div>
                              <p className="text-gray-800 font-medium">
                                Microphone not tested
                              </p>
                              <p className="text-gray-500 text-sm mt-1">
                                Click below and read the sample text aloud.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={startMicTest}
                            className="w-full flex items-center justify-center gap-2 px-6 h-12 rounded-2xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 transition-all duration-200"
                          >
                            Start Microphone Test
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {/* Quote card */}
                          <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                            <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">
                              Read this aloud
                            </p>
                            <p className="text-gray-700 text-base leading-relaxed">
                              {currentQuote}
                            </p>
                          </div>

                          {/* Level meter */}
                          <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500 font-medium">
                                Microphone Level
                              </span>
                              <span
                                className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                                  micConfirmed
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : micSilenceWarning
                                      ? "bg-red-50 text-red-600 border-red-200"
                                      : "bg-indigo-50 text-indigo-600 border-indigo-200"
                                }`}
                              >
                                {micConfirmed
                                  ? "Confirmed ✓"
                                  : micSilenceWarning
                                    ? "No sound detected"
                                    : "Listening…"}
                              </span>
                            </div>

                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full transition-all duration-75 rounded-full"
                                style={{
                                  width: `${micLevel}%`,
                                  background:
                                    micLevel > 60
                                      ? "linear-gradient(90deg,#10b981,#34d399)"
                                      : micLevel > 25
                                        ? "linear-gradient(90deg,#6366f1,#818cf8)"
                                        : "linear-gradient(90deg,#e5e7eb,#d1d5db)",
                                }}
                              />
                            </div>

                            <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                              <span>Low</span>
                              <span>{Math.round(micLevel)}%</span>
                              <span>High</span>
                            </div>
                          </div>

                          {/* Silence warning */}
                          {micSilenceWarning && !micConfirmed && (
                            <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-xl">
                              <svg
                                className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <div>
                                <p className="text-red-600 text-sm font-medium">
                                  Your microphone doesn't seem to be working
                                </p>
                                <p className="text-red-500 text-xs mt-0.5">
                                  No sound detected for{" "}
                                  {MIC_SILENCE_TIMEOUT_MS / 1000} seconds.
                                  Please check your microphone settings and try
                                  again.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Confirmed */}
                          {micConfirmed && (
                            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                              <svg
                                className="w-4 h-4"
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
                              Microphone confirmed — you're ready to continue
                            </div>
                          )}

                          <ContinueBtn
                            onClick={
                              micConfirmed ? handleMicSuccess : undefined
                            }
                            disabled={!micConfirmed}
                            hint="Enter"
                          >
                            {micConfirmed ? "Continue" : "Speak to confirm…"}
                          </ContinueBtn>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Step 4: Camera ── */}
                  {currentStep === 4 && (
                    <div>
                      <p className="text-gray-500 text-base leading-relaxed mb-5">
                        Position yourself so your face is centred and well-lit
                        in the preview below.
                      </p>
                      {primaryCameraError ? (
                        <div>
                          <div className="flex items-center gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-xl mb-5">
                            <svg
                              className="w-4 h-4 text-red-500 shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <p className="text-red-600 text-sm">
                              {primaryCameraError}
                            </p>
                          </div>
                          <button
                            onClick={startPrimaryCameraTest}
                            className="flex items-center gap-2.5 px-7 h-11 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 transition-all cursor-pointer"
                          >
                            Try Again
                          </button>
                        </div>
                      ) : !primaryCameraStream ? (
                        <div className="flex items-center gap-3 px-5 py-5 bg-white border border-gray-200 rounded-xl max-w-2xl shadow-sm">
                          <Spinner size="md" color="indigo" />
                          <p className="text-gray-500 text-sm">
                            Requesting camera access…
                          </p>
                        </div>
                      ) : (
                        <div className="max-w-2xl">
                          <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden ring-1 ring-gray-200 mb-5 shadow-md">
                            <video
                              ref={primaryVideoRef}
                              autoPlay
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                              style={{ transform: "scaleX(-1)" }}
                            />
                            <div className="absolute top-3 left-3">
                              <LiveBadge color="green" label="LIVE" />
                            </div>
                          </div>
                          <ContinueBtn
                            onClick={handlePrimaryCameraSuccess}
                            hint="Enter"
                          >
                            Looks Good
                          </ContinueBtn>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Step 5: Screen ── */}
                  {currentStep === 5 && (
                    <div>
                      <p className="text-gray-500 text-base leading-relaxed mb-5">
                        Share your entire screen so the session can be recorded
                        properly.
                      </p>
                      {!SCREEN_SHARE_SUPPORTED ? (
                        <div>
                          <div className="px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl mb-5 max-w-2xl">
                            <p className="text-amber-700 text-sm font-medium mb-1">
                              📱 Screen sharing unavailable on mobile
                            </p>
                            <p className="text-amber-600 text-xs">
                              Use a desktop browser to enable screen recording.
                            </p>
                          </div>
                          <ContinueBtn onClick={handleScreenShareSuccess}>
                            Continue Without Screen Share
                          </ContinueBtn>
                        </div>
                      ) : screenShareError ? (
                        <div>
                          <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-xl mb-5 max-w-2xl">
                            <svg
                              className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <p className="text-red-600 text-sm">
                              {screenShareError}
                            </p>
                          </div>
                          <button
                            onClick={startScreenShareTest}
                            className="flex items-center gap-2.5 px-7 h-11 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 transition-all cursor-pointer"
                          >
                            Try Again
                          </button>
                        </div>
                      ) : !screenShareStream ? (
                        <div className="max-w-2xl">
                          <div className="flex items-center gap-4 px-5 py-5 bg-white border border-gray-200 rounded-xl mb-4 shadow-sm">
                            <Spinner size="md" color="indigo" />
                            <div>
                              <p className="text-gray-700 text-sm font-medium">
                                Waiting for screen share
                              </p>
                              <p className="text-gray-400 text-xs mt-0.5">
                                Select your entire screen in the browser dialog
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={startScreenShareTest}
                            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors cursor-pointer"
                          >
                            Reopen dialog
                          </button>
                        </div>
                      ) : (
                        <div className="max-w-3xl">
                          <div className="relative w-full h-48 sm:h-56 bg-black rounded-2xl overflow-hidden ring-1 ring-gray-200 mb-4 shadow-md">
                            <video
                              ref={screenVideoRef}
                              autoPlay
                              muted
                              playsInline
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute top-3 left-3">
                              <LiveBadge color="violet" label="SHARING" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium mb-1">
                            <svg
                              className="w-4 h-4"
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
                            Screen share active
                          </div>
                          <ContinueBtn
                            onClick={handleScreenShareSuccess}
                            hint="Enter"
                          >
                            Continue
                          </ContinueBtn>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Step 6: Mobile ── */}
                  {currentStep === 6 && (
                    <div className="max-w-5xl">
                      <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-2xl">
                        Optionally connect your phone as a secondary camera for
                        enhanced proctoring. Scan the QR code below.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-6 items-start">
                        <div className="flex flex-col gap-4">
                          <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
                            <div className="flex justify-center">
                              <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                                {sessionData ? (
                                  <QRCodeCanvas
                                    value={`${window.location.origin}/mobile-camera?interviewId=${sessionData.interviewId}&userId=${user?.id}`}
                                    size={160}
                                  />
                                ) : (
                                  <div className="w-40 h-40 flex items-center justify-center">
                                    <Spinner size="lg" color="indigo" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
                            <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-widest mb-3">
                              How to connect
                            </p>
                            <ol className="space-y-3">
                              {[
                                "Open your phone camera",
                                "Scan the QR code",
                                "Tap the notification banner",
                                "Grant camera permissions",
                                "Place phone beside you",
                              ].map((t, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-3 text-gray-600 text-sm"
                                >
                                  <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs flex items-center justify-center font-semibold shrink-0">
                                    {i + 1}
                                  </div>
                                  {t}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>

                        <div className="flex flex-col gap-4">
                          <div className="relative rounded-2xl overflow-hidden bg-gray-900 ring-1 ring-gray-200 shadow-md">
                            <canvas
                              ref={mobileCanvasRef}
                              width="640"
                              height="480"
                              className="w-full aspect-video object-cover"
                              style={{ transform: "scaleX(-1)" }}
                            />
                            {!mobileCameraConnected && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 gap-3">
                                <Spinner size="md" color="orange" />
                                <p className="text-gray-400 text-sm">
                                  Waiting for phone connection…
                                </p>
                              </div>
                            )}
                            {mobileCameraConnected && (
                              <div className="absolute top-3 left-3">
                                <LiveBadge
                                  color="orange"
                                  label="MOBILE CONNECTED"
                                />
                              </div>
                            )}
                          </div>

                          {mobileCameraConnected ? (
                            <div>
                              <p className="text-emerald-600 text-sm font-medium flex items-center gap-2 mb-4">
                                <svg
                                  className="w-4 h-4"
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
                                Phone successfully connected via WebRTC
                              </p>
                              <ContinueBtn onClick={handleMobileCameraSuccess}>
                                Continue
                              </ContinueBtn>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <p className="text-gray-400 text-sm">
                                Waiting for your phone…
                              </p>
                              <button
                                onClick={
                                  socketConnectionFailed
                                    ? undefined
                                    : handleMobileCameraSuccess
                                }
                                disabled={socketConnectionFailed}
                                className={`text-sm underline underline-offset-4 transition-colors self-start ${
                                  socketConnectionFailed
                                    ? "text-gray-300 cursor-not-allowed"
                                    : "text-gray-400 hover:text-gray-700 cursor-pointer"
                                }`}
                              >
                                Skip mobile camera
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Step 7: Launch ── */}
                  {currentStep === 7 && (
                    <div className="max-w-2xl">
                      <p className="text-gray-500 text-base leading-relaxed mb-6">
                        Finalising all connections and preparing your session.
                        This only takes a moment.
                      </p>
                      {initError ? (
                        <div>
                          <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-xl mb-5">
                            <svg
                              className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <p className="text-red-600 text-sm">{initError}</p>
                          </div>
                          <button
                            onClick={() => {
                              setInitError(null);
                              setCurrentStep(6);
                            }}
                            className="flex items-center gap-2 px-7 h-11 rounded-xl font-semibold text-sm bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm transition-all cursor-pointer"
                          >
                            ← Go Back
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {[
                            { key: "socket", label: "Connecting to server" },
                            { key: "serverReady", label: "Server ready" },
                            { key: "questions", label: "Interview questions" },
                            {
                              key: "audioRecording",
                              label: "Audio recording (LiveKit egress)",
                            },
                            {
                              key: "videoRecording",
                              label: "Video recording (LiveKit egress)",
                            },
                            {
                              key: "screenRecording",
                              label: SCREEN_SHARE_SUPPORTED
                                ? "Screen recording (LiveKit egress)"
                                : "Screen recording (desktop only)",
                            },
                            {
                              key: "mobileRecording",
                              label: `Mobile recording${!mobileCameraConnected ? " (optional)" : " (LiveKit egress)"}`,
                            },
                          ].map(({ key, label }) => {
                            const status = initProgress[key];
                            const isActive = [
                              "connecting",
                              "waiting",
                              "starting",
                            ].includes(status);
                            const isSkipped = [
                              "skipped",
                              "optional",
                              "na",
                            ].includes(status);
                            return (
                              <div
                                key={key}
                                className={`flex items-center gap-3.5 px-5 py-3.5 rounded-xl border transition-all duration-300 ${
                                  status === true
                                    ? "bg-emerald-50 border-emerald-200"
                                    : isActive
                                      ? "bg-indigo-50 border-indigo-200"
                                      : isSkipped
                                        ? "bg-gray-50 border-gray-100"
                                        : "bg-white border-gray-200"
                                }`}
                              >
                                <StatusIcon status={status} />
                                <span
                                  className={`text-sm font-medium flex-1 ${
                                    status === true
                                      ? "text-emerald-700"
                                      : isActive
                                        ? "text-indigo-600"
                                        : isSkipped
                                          ? "text-gray-400"
                                          : "text-gray-500"
                                  }`}
                                >
                                  {label}
                                </span>
                                {isActive && (
                                  <span className="text-[10px] text-indigo-500 font-medium animate-pulse">
                                    {status}…
                                  </span>
                                )}
                                {status === true && (
                                  <span className="text-[10px] text-emerald-600 font-medium">
                                    done
                                  </span>
                                )}
                                {isSkipped && (
                                  <span className="text-[10px] text-gray-400 font-medium">
                                    auto
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          <div className="pt-2 flex items-center gap-2.5 text-gray-400 text-xs">
                            <Spinner size="sm" color="indigo" />
                            Almost ready — please wait…
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InterviewSetup;
