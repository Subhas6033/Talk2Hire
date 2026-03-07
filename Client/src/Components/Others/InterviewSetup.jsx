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

const MIC_REQUIRED_MS = 3000;
const MIC_SILENCE_TIMEOUT_MS = 3000;

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

// ── Shared keyframes + font import  ──────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Lora:wght@400;500;600&display=swap');

  .font-sora { font-family: 'Sora', sans-serif; }
  .font-dm   { font-family: 'DM Mono', monospace; }
  .font-lora { font-family: 'Lora', serif; }

  @keyframes is-fadeup {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes is-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes is-live {
    0%, 100% { box-shadow: 0 0 0 0 rgba(5,150,105,0.45); }
    50%       { box-shadow: 0 0 0 5px rgba(5,150,105,0); }
  }
  @keyframes is-pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.8); }
  }
  @keyframes is-shimmer {
    from { background-position: -200% 0; }
    to   { background-position:  200% 0; }
  }
  @keyframes is-wave {
    0%, 100% { height: 4px; }
    50%       { height: 14px; }
  }

  .is-fadeup   { animation: is-fadeup 0.45s cubic-bezier(0.25,0.46,0.45,0.94) both; }
  .is-spin     { animation: is-spin 0.8s linear infinite; }
  .is-live-dot { animation: is-live 1.6s ease-in-out infinite; }
  .is-pulse    { animation: is-pulse-dot 1.4s ease-in-out infinite; }
  .is-shimmer  {
    background: linear-gradient(90deg,#F0EDE8 25%,#E8E4DE 50%,#F0EDE8 75%);
    background-size: 200% 100%;
    animation: is-shimmer 1.8s infinite;
    border-radius: 8px;
  }

  /* mic waveform bar — animated height needs vanilla CSS */
  .mic-bar {
    width: 2px;
    height: 4px;
    border-radius: 99px;
    animation: is-wave 1s ease-in-out infinite;
  }

  /* step connector line */
  .step-line {
    position: absolute;
    left: 15px;
    top: 40px;
    bottom: -12px;
    width: 2px;
    background: linear-gradient(to bottom, #E8E4DE, transparent);
  }

  /* subtle page texture */
  .is-root {
    font-family: 'Sora', sans-serif;
    background-color: #F7F5F2;
    background-image:
      radial-gradient(ellipse at 10% 0%, rgba(37,99,235,0.04) 0%, transparent 45%),
      radial-gradient(ellipse at 90% 100%, rgba(124,58,237,0.03) 0%, transparent 45%);
  }

  .is-sidebar {
    background: #FFFFFF;
    border-right: 1px solid #ECEAE6;
  }

  .is-panel {
    background: #FFFFFF;
    border: 1px solid #E8E4DE;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04);
    overflow: hidden;
    transition: box-shadow 0.2s ease;
  }
  .is-panel:hover {
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  }

  /* progress bar track */
  .is-progress-track {
    background: #F0EDE8;
    border-radius: 99px;
    overflow: hidden;
    height: 3px;
  }
  .is-progress-fill {
    height: 100%;
    border-radius: 99px;
    background: linear-gradient(90deg, #6366F1, #4F46E5);
    transition: width 0.6s cubic-bezier(0.34,1.56,0.64,1);
  }

  /* video ring */
  .is-video-ring {
    border: 1px solid #E8E4DE;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.10);
  }

  /* kbd chip */
  .is-kbd {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 5px;
    background: #F7F5F2;
    border: 1px solid #E8E4DE;
    color: #78716C;
  }
`;

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: "Skills", sub: "Choose your focus areas" },
  { num: 2, label: "Guidelines", sub: "Rules & expectations" },
  { num: 3, label: "Microphone", sub: "Audio verification" },
  { num: 4, label: "Camera", sub: "Video feed setup" },
  { num: 5, label: "Screen", sub: "Desktop capture" },
  { num: 6, label: "Mobile", sub: "Secondary angle" },
  { num: 7, label: "Launch", sub: "All checks passed" },
];

// ── Step SVG paths ────────────────────────────────────────────────────────────
const STEP_PATHS = {
  1: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  2: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  3: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
  4: "M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z",
  5: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  6: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
  7: "M13 10V3L4 14h7v7l9-11h-7z",
};

// ── Animation variants ────────────────────────────────────────────────────────
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

// ── Sub-components ────────────────────────────────────────────────────────────

const CheckIcon = ({ cls = "w-3.5 h-3.5" }) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const AlertIcon = ({ cls = "w-4 h-4" }) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const Spinner = ({ size = 18, color = "#6366F1", track = "#E0E7FF" }) => (
  <div
    className="is-spin rounded-full shrink-0"
    style={{
      width: size,
      height: size,
      border: `2px solid ${track}`,
      borderTopColor: color,
    }}
  />
);

const StatusIcon = ({ status }) => {
  if (status === true)
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
        <CheckIcon cls="w-3 h-3 text-emerald-600" />
      </div>
    );
  if (["connecting", "waiting", "starting"].includes(status))
    return (
      <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
        <Spinner size={12} color="#6366F1" track="#E0E7FF" />
      </div>
    );
  if (["skipped", "optional", "na"].includes(status))
    return (
      <div className="w-6 h-6 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
        <svg
          className="w-2.5 h-2.5 text-stone-400"
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
    <div className="w-6 h-6 rounded-full bg-stone-100 border border-stone-200 shrink-0" />
  );
};

const LiveBadge = ({ color = "green", label }) => {
  const map = {
    green: {
      dot: "bg-emerald-400",
      text: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-200",
    },
    orange: {
      dot: "bg-orange-400",
      text: "text-orange-700",
      bg: "bg-orange-50 border-orange-200",
    },
    violet: {
      dot: "bg-indigo-400",
      text: "text-indigo-700",
      bg: "bg-indigo-50 border-indigo-200",
    },
  };
  const c = map[color];
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-dm text-[10px] font-medium tracking-[0.06em] uppercase ${c.bg} ${c.text}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${c.dot} is-pulse`} />
      {label}
    </div>
  );
};

const ContinueBtn = ({ onClick, disabled = false, children, hint }) => (
  <div className="flex flex-wrap items-center gap-4 mt-7">
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-7 h-11 rounded-xl font-sora font-semibold text-sm transition-all duration-200 ${
        disabled
          ? "bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200"
          : "bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-[0_4px_16px_rgba(79,70,229,0.25)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.32)] cursor-pointer"
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
      <span className="font-sora text-stone-400 text-sm">
        or press <kbd className="is-kbd">{hint}</kbd>
      </span>
    )}
  </div>
);

const CheckRow = ({ children }) => (
  <div className="flex items-center gap-3.5 px-4 py-3.5 bg-[#FAFAF9] border border-[#F0EDE8] rounded-xl hover:border-[#E8E4DE] transition-colors duration-150">
    <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
      <CheckIcon cls="w-2.5 h-2.5 text-indigo-600" />
    </div>
    <span className="font-sora text-[#57534E] text-sm leading-snug">
      {children}
    </span>
  </div>
);

const StepHeaderIcon = ({ num }) => (
  <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
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
        d={STEP_PATHS[num]}
      />
    </svg>
  </div>
);

const InfoBanner = ({ type = "info", children }) => {
  const map = {
    info: {
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-700",
      icon: <Spinner size={14} color="#3B82F6" track="#BFDBFE" />,
    },
    success: {
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-700",
      icon: <CheckIcon cls="w-3.5 h-3.5 text-emerald-600" />,
    },
    error: {
      bg: "bg-red-50 border-red-200",
      text: "text-red-700",
      icon: <AlertIcon cls="w-4 h-4 text-red-500" />,
    },
    warning: {
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-700",
      icon: <AlertIcon cls="w-4 h-4 text-amber-500" />,
    },
  };
  const c = map[type];
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${c.bg} is-fadeup`}
    >
      <div className="mt-0.5 shrink-0">{c.icon}</div>
      <p className={`font-sora text-xs font-medium leading-relaxed ${c.text}`}>
        {children}
      </p>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
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
  const [micSilenceWarning, setMicSilenceWarning] = useState(false);
  const speakingStartRef = useRef(null);
  const lastSoundTimeRef = useRef(null);
  const silenceTimerRef = useRef(null);

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
      lastSoundTimeRef.current = Date.now();

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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <div className="is-root fixed inset-0 flex overflow-hidden font-sora">
        {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 is-sidebar">
          {/* Brand */}
          <div className="px-5 py-5 border-b border-[#ECEAE6]">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
                }}
              >
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
              <div>
                <p className="font-sora font-bold text-[13px] text-[#1C1917] leading-none">
                  Talk2Hire
                </p>
                <p className="font-dm text-[9px] text-stone-400 tracking-[0.06em] uppercase leading-none mt-0.5">
                  Interview Setup
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="flex-1 flex flex-col justify-center px-3 py-5 gap-0.5">
            {STEPS.map((step, idx) => {
              const done = currentStep > step.num;
              const active = currentStep === step.num;
              return (
                <div key={step.num} className="relative">
                  {/* Connector line between steps */}
                  {idx < STEPS.length - 1 && (
                    <div
                      className="absolute left-3.75 top-10 w-0.5 h-3"
                      style={{
                        background: done
                          ? "linear-gradient(to bottom,#10B981,#D1FAE5)"
                          : "linear-gradient(to bottom,#E8E4DE,transparent)",
                      }}
                    />
                  )}
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      active ? "bg-indigo-50 border border-indigo-100" : ""
                    }`}
                  >
                    {/* Step number / check bubble */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-dm text-[11px] font-medium shrink-0 transition-all duration-300 ${
                        done
                          ? "bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
                          : active
                            ? "bg-[#4F46E5] text-white ring-2 ring-indigo-200 ring-offset-2 shadow-[0_2px_8px_rgba(79,70,229,0.3)]"
                            : "bg-stone-100 text-stone-400 border border-stone-200"
                      }`}
                    >
                      {done ? <CheckIcon cls="w-3.5 h-3.5" /> : step.num}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span
                        className={`font-sora text-sm font-semibold leading-none transition-colors ${
                          active
                            ? "text-indigo-700"
                            : done
                              ? "text-emerald-600"
                              : "text-stone-400"
                        }`}
                      >
                        {step.label}
                      </span>
                      <span
                        className={`font-dm text-[10px] leading-none mt-1 tracking-[0.02em] ${active ? "text-indigo-400" : "text-stone-400"}`}
                      >
                        {step.sub}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="px-4 pb-5 border-t border-[#ECEAE6] pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-dm text-[10px] text-stone-400 tracking-[0.04em] uppercase">
                Progress
              </span>
              <span className="font-dm text-[10px] text-indigo-600 font-medium">
                {progressPct}%
              </span>
            </div>
            <div className="is-progress-track">
              <div
                className="is-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </aside>

        {/* ── Main content ────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#F7F5F2]">
          {/* Mobile top bar */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3.5 border-b border-[#ECEAE6] bg-white shrink-0">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
                }}
              >
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
              <span className="font-sora text-[#1C1917] text-sm font-semibold">
                Interview Setup
              </span>
            </div>
            {/* Mobile step dots */}
            <div className="flex items-center gap-1">
              {STEPS.map((s) => (
                <div
                  key={s.num}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    currentStep === s.num
                      ? "w-5 bg-indigo-500"
                      : currentStep > s.num
                        ? "w-2 bg-emerald-500"
                        : "w-2 bg-stone-200"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Scrollable content */}
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
                    {/* ── Step header ── */}
                    <div className="flex items-center gap-3.5 mb-6">
                      <StepHeaderIcon num={currentStep} />
                      <div>
                        <p className="font-dm text-stone-400 text-[10px] tracking-[0.14em] uppercase mb-0.5">
                          Step {currentStep} of {STEPS.length}
                        </p>
                        <h1 className="font-sora text-2xl sm:text-[28px] font-bold text-[#1C1917] leading-tight tracking-tight">
                          {STEPS[currentStep - 1].label}
                        </h1>
                      </div>
                    </div>

                    {/* Generating / ready banner */}
                    {currentStep > 1 &&
                      currentStep < 7 &&
                      isGeneratingQuestions && (
                        <div className="mb-4">
                          <InfoBanner type="info">
                            Generating questions in background — continue freely
                          </InfoBanner>
                        </div>
                      )}
                    {currentStep > 1 &&
                      currentStep < 7 &&
                      questionsReady &&
                      !isGeneratingQuestions && (
                        <div className="mb-4">
                          <InfoBanner type="success">
                            Questions ready
                          </InfoBanner>
                        </div>
                      )}

                    {/* Global error */}
                    {error && (
                      <div className="mb-4">
                        <InfoBanner type="error">{error}</InfoBanner>
                      </div>
                    )}

                    {/* ── Step 1: Skills ── */}
                    {currentStep === 1 && (
                      <div>
                        <p className="font-sora text-stone-500 text-base leading-relaxed mb-5">
                          {hasExistingSkills
                            ? "Your interview will be tailored to your configured skills shown below."
                            : "Choose the areas you'd like to be interviewed on. These will shape your questions."}
                        </p>
                        {!hasExistingSkills ? (
                          <SkillsSelector
                            selectedSkills={skills || []}
                            onSkillsChange={(s) =>
                              setValue("skills", s, { shouldValidate: true })
                            }
                          />
                        ) : (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {user.skill.split(",").map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg font-sora text-indigo-700 text-xs font-medium"
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
                        <p className="font-sora text-stone-500 text-base leading-relaxed mb-5">
                          Please read and acknowledge the following before your
                          session begins.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                            !!error ||
                            (!questionsReady && !isGeneratingQuestions)
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
                          <h2 className="font-sora text-xl font-semibold text-[#1C1917]">
                            Microphone Check
                          </h2>
                          <p className="font-sora text-stone-500 text-sm mt-1">
                            Speak clearly for at least {MIC_REQUIRED_MS / 1000}{" "}
                            seconds to confirm your microphone is working.
                          </p>
                        </div>

                        {!isMicTesting ? (
                          <div className="space-y-4">
                            {/* Idle mic card */}
                            <div className="is-panel flex items-start gap-4 p-5">
                              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
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
                                    d={STEP_PATHS[3]}
                                  />
                                </svg>
                              </div>
                              <div>
                                <p className="font-sora font-semibold text-[#1C1917] text-sm">
                                  Microphone not tested
                                </p>
                                <p className="font-sora text-stone-500 text-xs mt-1">
                                  Click below and read the sample text aloud.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={startMicTest}
                              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl font-sora font-semibold text-sm bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-[0_4px_16px_rgba(79,70,229,0.25)] transition-all duration-200 cursor-pointer"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d={STEP_PATHS[3]}
                                />
                              </svg>
                              Start Microphone Test
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Quote card */}
                            <div className="is-panel p-5">
                              <p className="font-dm text-[10px] tracking-[0.08em] uppercase text-stone-400 mb-3">
                                Read this aloud
                              </p>
                              <p className="font-lora text-[#1C1917] text-base leading-relaxed italic">
                                {currentQuote}
                              </p>
                            </div>

                            {/* Level meter card */}
                            <div className="is-panel p-5 space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="font-dm text-[10px] uppercase tracking-[0.06em] text-stone-400">
                                  Microphone Level
                                </span>
                                <span
                                  className={`font-dm text-[10px] font-medium px-2.5 py-1 rounded-full border tracking-[0.04em] uppercase transition-all duration-300 ${
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
                                      ? "No sound"
                                      : "Listening…"}
                                </span>
                              </div>

                              {/* Level bar */}
                              <div className="w-full h-2.5 bg-[#F0EDE8] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-75"
                                  style={{
                                    width: `${micLevel}%`,
                                    background:
                                      micLevel > 60
                                        ? "linear-gradient(90deg,#10b981,#34d399)"
                                        : micLevel > 25
                                          ? "linear-gradient(90deg,#4F46E5,#818cf8)"
                                          : "linear-gradient(90deg,#E8E4DE,#D4CDC7)",
                                  }}
                                />
                              </div>

                              {/* Waveform visualiser */}
                              <div className="flex items-center gap-1 h-5">
                                {Array.from({ length: 20 }).map((_, i) => {
                                  const active = micLevel > (i / 20) * 100;
                                  return (
                                    <div
                                      key={i}
                                      className="mic-bar flex-1"
                                      style={{
                                        background: active
                                          ? micLevel > 60
                                            ? "#10b981"
                                            : "#4F46E5"
                                          : "#E8E4DE",
                                        animationDelay: `${i * 0.05}s`,
                                        animationPlayState:
                                          micLevel > 10 ? "running" : "paused",
                                      }}
                                    />
                                  );
                                })}
                              </div>

                              <div className="flex justify-between font-dm text-[10px] text-stone-400">
                                <span>LOW</span>
                                <span>{Math.round(micLevel)}%</span>
                                <span>HIGH</span>
                              </div>
                            </div>

                            {/* Silence warning */}
                            {micSilenceWarning && !micConfirmed && (
                              <InfoBanner type="error">
                                No sound detected for{" "}
                                {MIC_SILENCE_TIMEOUT_MS / 1000} seconds. Please
                                check your microphone settings and try again.
                              </InfoBanner>
                            )}

                            {/* Confirmed */}
                            {micConfirmed && (
                              <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold is-fadeup">
                                <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                                  <CheckIcon cls="w-2.5 h-2.5 text-emerald-600" />
                                </div>
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
                        <p className="font-sora text-stone-500 text-base leading-relaxed mb-5">
                          Position yourself so your face is centred and well-lit
                          in the preview below.
                        </p>
                        {primaryCameraError ? (
                          <div className="space-y-4">
                            <InfoBanner type="error">
                              {primaryCameraError}
                            </InfoBanner>
                            <button
                              onClick={startPrimaryCameraTest}
                              className="flex items-center gap-2 px-7 h-11 rounded-xl font-sora font-semibold text-sm bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-[0_4px_16px_rgba(79,70,229,0.25)] transition-all cursor-pointer"
                            >
                              Try Again
                            </button>
                          </div>
                        ) : !primaryCameraStream ? (
                          <div className="is-panel flex items-center gap-3 px-5 py-5 max-w-2xl">
                            <Spinner size={18} />
                            <p className="font-sora text-stone-500 text-sm">
                              Requesting camera access…
                            </p>
                          </div>
                        ) : (
                          <div className="max-w-2xl">
                            <div className="is-video-ring relative aspect-video bg-[#111] mb-5">
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
                              {/* Corner brackets overlay */}
                              <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-white/30 rounded-tr" />
                                <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-white/30 rounded-br" />
                                <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-white/30 rounded-bl" />
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
                        <p className="font-sora text-stone-500 text-base leading-relaxed mb-5">
                          Share your entire screen so the session can be
                          recorded properly.
                        </p>
                        {!SCREEN_SHARE_SUPPORTED ? (
                          <div className="space-y-4">
                            <InfoBanner type="warning">
                              📱 Screen sharing unavailable on mobile — use a
                              desktop browser to enable screen recording.
                            </InfoBanner>
                            <ContinueBtn onClick={handleScreenShareSuccess}>
                              Continue Without Screen Share
                            </ContinueBtn>
                          </div>
                        ) : screenShareError ? (
                          <div className="space-y-4">
                            <InfoBanner type="error">
                              {screenShareError}
                            </InfoBanner>
                            <button
                              onClick={startScreenShareTest}
                              className="flex items-center gap-2 px-7 h-11 rounded-xl font-sora font-semibold text-sm bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-[0_4px_16px_rgba(79,70,229,0.25)] transition-all cursor-pointer"
                            >
                              Try Again
                            </button>
                          </div>
                        ) : !screenShareStream ? (
                          <div className="max-w-2xl space-y-3">
                            <div className="is-panel flex items-center gap-4 px-5 py-5">
                              <Spinner size={18} />
                              <div>
                                <p className="font-sora text-[#1C1917] text-sm font-semibold">
                                  Waiting for screen share
                                </p>
                                <p className="font-sora text-stone-400 text-xs mt-0.5">
                                  Select your entire screen in the browser
                                  dialog
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={startScreenShareTest}
                              className="font-dm text-[11px] text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors cursor-pointer tracking-[0.03em]"
                            >
                              Reopen dialog
                            </button>
                          </div>
                        ) : (
                          <div className="max-w-3xl space-y-4">
                            <div className="is-video-ring relative h-48 sm:h-56 bg-[#111]">
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
                            <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                              <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                                <CheckIcon cls="w-2.5 h-2.5 text-emerald-600" />
                              </div>
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
                        <p className="font-sora text-stone-500 text-sm leading-relaxed mb-6 max-w-2xl">
                          Optionally connect your phone as a secondary camera
                          for enhanced proctoring. Scan the QR code below.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-5 items-start">
                          {/* Left: QR + instructions */}
                          <div className="flex flex-col gap-4">
                            <div className="is-panel p-5">
                              <div className="flex justify-center">
                                <div className="p-4 bg-[#FAFAF9] border border-[#F0EDE8] rounded-xl">
                                  {sessionData ? (
                                    <QRCodeCanvas
                                      value={`${window.location.origin}/mobile-camera?interviewId=${sessionData.interviewId}&userId=${user?.id}`}
                                      size={160}
                                    />
                                  ) : (
                                    <div className="w-40 h-40 flex items-center justify-center">
                                      <Spinner size={28} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="is-panel p-5">
                              <p className="font-dm text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-400 mb-3.5">
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
                                    className="flex items-start gap-3 font-sora text-stone-600 text-sm"
                                  >
                                    <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 font-dm text-[10px] text-indigo-600 flex items-center justify-center shrink-0 font-medium">
                                      {i + 1}
                                    </div>
                                    {t}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>

                          {/* Right: canvas + status */}
                          <div className="flex flex-col gap-4">
                            <div className="is-video-ring relative bg-[#111] aspect-video overflow-hidden">
                              <canvas
                                ref={mobileCanvasRef}
                                width="640"
                                height="480"
                                className="w-full aspect-video object-cover"
                                style={{ transform: "scaleX(-1)" }}
                              />
                              {!mobileCameraConnected && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#111]/95">
                                  <Spinner
                                    size={24}
                                    color="#EA580C"
                                    track="#FED7AA"
                                  />
                                  <p className="font-dm text-[11px] text-stone-500 tracking-[0.05em] uppercase">
                                    Waiting for phone…
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
                                <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold mb-4 is-fadeup">
                                  <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                                    <CheckIcon cls="w-2.5 h-2.5 text-emerald-600" />
                                  </div>
                                  Phone connected via WebRTC
                                </div>
                                <ContinueBtn
                                  onClick={handleMobileCameraSuccess}
                                >
                                  Continue
                                </ContinueBtn>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <p className="font-sora text-stone-400 text-sm">
                                  Waiting for your phone…
                                </p>
                                <button
                                  onClick={
                                    socketConnectionFailed
                                      ? undefined
                                      : handleMobileCameraSuccess
                                  }
                                  disabled={socketConnectionFailed}
                                  className={`font-sora text-sm underline underline-offset-4 transition-colors self-start ${
                                    socketConnectionFailed
                                      ? "text-stone-300 cursor-not-allowed"
                                      : "text-stone-400 hover:text-stone-700 cursor-pointer"
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
                        <p className="font-sora text-stone-500 text-base leading-relaxed mb-6">
                          Finalising all connections and preparing your session.
                          This only takes a moment.
                        </p>
                        {initError ? (
                          <div className="space-y-4">
                            <InfoBanner type="error">{initError}</InfoBanner>
                            <button
                              onClick={() => {
                                setInitError(null);
                                setCurrentStep(6);
                              }}
                              className="flex items-center gap-2 px-7 h-11 rounded-xl font-sora font-semibold text-sm bg-white hover:bg-[#FAFAF9] text-[#1C1917] border border-[#E8E4DE] shadow-sm transition-all cursor-pointer"
                            >
                              ← Go Back
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {[
                              { key: "socket", label: "Connecting to server" },
                              { key: "serverReady", label: "Server ready" },
                              {
                                key: "questions",
                                label: "Interview questions",
                              },
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
                                        ? "bg-indigo-50 border-indigo-100"
                                        : isSkipped
                                          ? "bg-[#FAFAF9] border-[#F0EDE8]"
                                          : "bg-white border-[#E8E4DE]"
                                  }`}
                                >
                                  <StatusIcon status={status} />
                                  <span
                                    className={`font-sora text-sm font-medium flex-1 ${
                                      status === true
                                        ? "text-emerald-700"
                                        : isActive
                                          ? "text-indigo-600"
                                          : isSkipped
                                            ? "text-stone-400"
                                            : "text-stone-500"
                                    }`}
                                  >
                                    {label}
                                  </span>
                                  {isActive && (
                                    <span className="font-dm text-[10px] text-indigo-500 tracking-[0.04em] animate-pulse">
                                      {status}…
                                    </span>
                                  )}
                                  {status === true && (
                                    <span className="font-dm text-[10px] text-emerald-600 tracking-[0.04em]">
                                      done
                                    </span>
                                  )}
                                  {isSkipped && (
                                    <span className="font-dm text-[10px] text-stone-400 tracking-[0.04em]">
                                      auto
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            <div className="pt-2 flex items-center gap-2.5 text-stone-400">
                              <Spinner size={14} />
                              <span className="font-dm text-[11px] tracking-[0.04em]">
                                Almost ready — please wait…
                              </span>
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
    </>
  );
};

export default InterviewSetup;
