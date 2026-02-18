import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { Card } from "../Common/Card";
import { Button, SkillsSelector } from "../index";
import { startInterview } from "../../API/interviewApi";
import { QRCodeCanvas } from "qrcode.react";
import { io } from "socket.io-client";
import { useStreams } from "../../Hooks/streamContext";
import { setAllStreams } from "../../Hooks/streamSingleton";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

const IS_MOBILE =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
const SCREEN_SHARE_SUPPORTED =
  !IS_MOBILE && !!navigator.mediaDevices?.getDisplayMedia;

/* ── tiny helpers ─────────────────────────────────────────────────────────── */

const StatusIcon = ({ status }) => {
  if (status === true)
    return (
      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
        <svg
          className="w-4 h-4 text-emerald-400"
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
      <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center shrink-0">
        <div className="animate-spin w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full" />
      </div>
    );
  if (["skipped", "optional", "na"].includes(status))
    return (
      <div className="w-7 h-7 rounded-full bg-slate-700/60 border border-slate-600/40 flex items-center justify-center shrink-0">
        <svg
          className="w-3.5 h-3.5 text-slate-500"
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
    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0" />
  );
};

const LiveBadge = ({ color = "green", label }) => {
  const colorMap = {
    green: "bg-emerald-500/90",
    orange: "bg-orange-500/90",
    violet: "bg-violet-500/90",
  };
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 ${colorMap[color]} backdrop-blur-sm rounded-md`}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      <span className="text-white text-[10px] font-bold tracking-widest">
        {label}
      </span>
    </div>
  );
};

const InfoBadge = ({ children, variant = "green" }) => {
  const variantMap = {
    green: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    blue: "bg-blue-500/10 border-blue-500/25 text-blue-300",
    yellow: "bg-amber-500/10 border-amber-500/25 text-amber-300",
    red: "bg-red-500/10 border-red-500/25 text-red-400",
  };
  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium ${variantMap[variant]}`}
    >
      {children}
    </div>
  );
};

const Spinner = ({ size = "md", color = "violet" }) => {
  const sizeMap = {
    sm: "w-4 h-4 border-2",
    md: "w-5 h-5 border-2",
    lg: "w-10 h-10 border-3",
  };
  const colorMap = {
    violet: "border-violet-400/30 border-t-violet-400",
    blue: "border-blue-400/30 border-t-blue-400",
    orange: "border-orange-500/30 border-t-orange-500",
  };
  return (
    <div
      className={`animate-spin rounded-full shrink-0 ${sizeMap[size]} ${colorMap[color]}`}
    />
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */

const InterviewSetup = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const streamsRef = useStreams();

  const { watch, setValue } = useForm({
    mode: "onChange",
    defaultValues: { skills: [] },
  });
  const skills = watch("skills");

  const steps = [
    { num: 1, label: "Skills" },
    { num: 2, label: "Guidelines" },
    { num: 3, label: "Microphone" },
    { num: 4, label: "Camera" },
    { num: 5, label: "Screen" },
    { num: 6, label: "Mobile" },
    { num: 7, label: "Launch" },
  ];

  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState(null);

  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsReady, setQuestionsReady] = useState(false);
  const [sessionData, setSessionData] = useState(null);

  const [micStream, setMicStream] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [isMicTesting, setIsMicTesting] = useState(false);

  const [primaryCameraStream, setPrimaryCameraStream] = useState(null);
  const [primaryCameraError, setPrimaryCameraError] = useState(null);

  const [mobileCameraConnected, setMobileCameraConnected] = useState(false);
  const [mobileFramesReceived, setMobileFramesReceived] = useState(0);

  const [screenShareStream, setScreenShareStream] = useState(null);
  const [screenShareError, setScreenShareError] = useState(null);
  const screenShareStreamRef = useRef(null);

  // ── Step 7 progress — simplified for LiveKit (no audio/video pre-warm) ────
  const [initProgress, setInitProgress] = useState({
    questions: false,
    socket: false,
    serverReady: false,
    // LiveKit egress starts server-side when client_ready fires,
    // so we don't pre-register audio/video sessions here anymore.
    // These are shown as informational-only "n/a" items.
    audioRecording: "na",
    videoRecording: "na",
    screenRecording: "na",
    mobileRecording: "na",
  });
  const [initError, setInitError] = useState(null);

  /* ── refs ───────────────────────────────────────────────────────────────── */
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

  /* ── STEP 1 ─────────────────────────────────────────────────────────────── */
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
        startInterview({ skills: !hasExistingSkills ? skills : undefined }),
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
        })
        .finally(() => setIsGeneratingQuestions(false));
    }
  };

  /* ── STEP 2 ─────────────────────────────────────────────────────────────── */
  const handleAcceptGuidelines = () => {
    setError(null);
    setCurrentStep(3);
  };

  /* ── STEP 3 ─────────────────────────────────────────────────────────────── */
  const handleMicSuccess = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    micTestCleanupRef.current = true;
    analyserRef.current = null;
    setError(null);
    setCurrentStep(4);
  };

  /* ── STEP 4 ─────────────────────────────────────────────────────────────── */
  const handlePrimaryCameraSuccess = () => {
    setError(null);
    setCurrentStep(5);
    startScreenShareTest();
  };

  /* ── STEP 5 ─────────────────────────────────────────────────────────────── */
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
        `The following devices are not active: ${missing.join(", ")}. Please configure them again.`,
      );
      return;
    }
    setError(null);
    setCurrentStep(6);
  };

  /* ── STEP 6 ─────────────────────────────────────────────────────────────── */
  const handleMobileCameraSuccess = () => {
    setError(null);
    setCurrentStep(7);
  };

  /* ── MIC TEST ────────────────────────────────────────────────────────────── */
  const startMicTest = async () => {
    try {
      setIsMicTesting(true);
      setError(null);
      micTestCleanupRef.current = false;
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
        setMicLevel(Math.min(100, (avg / 128) * 100));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      setError(`Microphone error: ${err.message}`);
      setIsMicTesting(false);
      micTestCleanupRef.current = true;
    }
  };

  /* ── PRIMARY CAMERA ─────────────────────────────────────────────────────── */
  const startPrimaryCameraTest = async () => {
    try {
      setPrimaryCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setPrimaryCameraStream(stream);
    } catch (err) {
      setPrimaryCameraError("Camera permission denied.");
    }
  };

  useEffect(() => {
    if (currentStep === 4) startPrimaryCameraTest();
  }, [currentStep]);

  useEffect(() => {
    if (primaryVideoRef.current && primaryCameraStream) {
      primaryVideoRef.current.srcObject = primaryCameraStream;
      primaryVideoRef.current.play().catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      });
    }
  }, [primaryCameraStream]);

  /* ── MOBILE CAMERA SOCKET (setup preview only) ──────────────────────────── */
  // In setup mode we still want to show the connection indicator.
  // The mobile page now uses LiveKit, so it will emit secondary_camera_connected
  // via the settings socket, giving us the "connected" signal.
  // There are no more mobile_camera_frame events in LiveKit mode,
  // so the canvas preview will be blank — that's expected and fine.
  useEffect(() => {
    if (currentStep !== 6) return;

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
      });
      settingsSocketRef.current = socket;
      socket.on("connect", () =>
        console.log("✅ Settings socket connected:", socket.id),
      );

      // secondary_camera_ready fires when mobile page emits secondary_camera_connected
      socket.on("secondary_camera_ready", () => {
        console.log("📱 Mobile camera connected via LiveKit");
        setMobileCameraConnected(true);
      });

      // mobile_camera_frame is no longer sent by the new MobileCameraPage,
      // but we keep the listener in case of fallback / older clients.
      socket.on("mobile_camera_frame", (data) => {
        if (!data?.frame || !mobileCanvasRef.current) return;
        const img = new Image();
        img.onload = () => {
          const ctx = mobileCanvasRef.current?.getContext("2d");
          if (ctx) {
            ctx.drawImage(
              img,
              0,
              0,
              mobileCanvasRef.current.width,
              mobileCanvasRef.current.height,
            );
            setMobileFramesReceived((prev) => prev + 1);
          }
        };
        img.src = data.frame;
      });

      socket.on("connect_error", () =>
        setError("Failed to connect to server for mobile camera."),
      );
    };

    if (sessionDataRef.current) {
      connect(sessionDataRef.current);
    } else {
      const interval = setInterval(() => {
        if (sessionDataRef.current) {
          clearInterval(interval);
          connect(sessionDataRef.current);
        }
      }, 300);
    }

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [currentStep]);

  /* ── SCREEN SHARE ───────────────────────────────────────────────────────── */
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
        await screenVideoRef.current.play().catch((err) => {
          if (err.name !== "AbortError") console.error(err);
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

  /* ══════════════════════════════════════════════════════════════════════════
     STEP 7: PRE-INITIALIZATION (LiveKit-aware)
     
     With LiveKit, the server starts egress automatically:
       • composite egress starts in handleInterviewSocket on client_ready
       • screen egress starts on livekit_track_published (screen_share source)  
       • mobile egress starts on livekit_participant_joined (mobile_ identity)
     
     So in setup we only need to:
       1. Connect the interview socket
       2. Wait for server_ready
       3. Wait for question generation to complete
       4. Navigate to /interview/live
     
     We do NOT pre-register audio/video/screen sessions — those are owned by
     the LiveKit egress pipeline on the server.
  ══════════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (currentStep !== 7) return;

    let mounted = true;
    let socket = null;

    const initializeInterview = async () => {
      try {
        console.log("🔄 Starting pre-initialization (LiveKit mode)...");

        // ── Wait for sessionData ──────────────────────────────────────────────
        if (!sessionDataRef.current) {
          console.log("⏳ Waiting for session data...");
          await new Promise((resolve, reject) => {
            if (sessionDataRef.current) return resolve();
            const timeout = setTimeout(
              () =>
                reject(
                  new Error("Session creation timed out. Please try again."),
                ),
              60000,
            );
            const interval = setInterval(() => {
              if (sessionDataRef.current) {
                clearTimeout(timeout);
                clearInterval(interval);
                resolve();
              }
            }, 300);
          });
        }

        const session = sessionDataRef.current;

        // Disconnect settings socket if still open from Step 6
        if (settingsSocketRef.current?.connected) {
          settingsSocketRef.current.disconnect();
          settingsSocketRef.current = null;
          await new Promise((r) => setTimeout(r, 300));
        }

        // ── 1. Connect interview socket ───────────────────────────────────────
        if (mounted)
          setInitProgress((prev) => ({ ...prev, socket: "connecting" }));
        socket = io(SOCKET_URL, {
          query: {
            interviewId: session.interviewId,
            userId: session.userId,
            type: "interview",
          },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
        });
        interviewSocketRef.current = socket;

        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Socket connection timeout")),
            20000,
          );
          socket.once("connect", () => {
            clearTimeout(timer);
            // Tell server we are in setup mode (it will not emit client_ready egress yet)
            socket.emit("setup_mode", {
              setupInProgress: true,
              interviewId: session.interviewId,
              userId: session.userId,
            });
            if (mounted) setInitProgress((prev) => ({ ...prev, socket: true }));
            resolve();
          });
          socket.once("connect_error", (err) => {
            clearTimeout(timer);
            reject(err);
          });
        });

        // ── 2. Wait for server_ready ──────────────────────────────────────────
        if (mounted)
          setInitProgress((prev) => ({ ...prev, serverReady: "waiting" }));
        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Server ready timeout")),
            20000,
          );
          socket.once("server_ready", () => {
            clearTimeout(timer);
            if (mounted)
              setInitProgress((prev) => ({ ...prev, serverReady: true }));
            resolve();
          });
        });

        // ── 3. Wait for question generation ──────────────────────────────────
        if (!questionsReadyRef.current) {
          console.log("⏳ Questions still generating — waiting...");
          if (mounted)
            setInitProgress((prev) => ({ ...prev, questions: "waiting" }));
          await new Promise((resolve, reject) => {
            if (questionsReadyRef.current) return resolve();
            const timeout = setTimeout(
              () =>
                reject(
                  new Error("Question generation timed out. Please try again."),
                ),
              60000,
            );
            const interval = setInterval(() => {
              if (questionsReadyRef.current) {
                clearTimeout(timeout);
                clearInterval(interval);
                resolve();
              }
            }, 300);
          });
        }
        if (mounted) setInitProgress((prev) => ({ ...prev, questions: true }));

        // ── 4. Mark LiveKit-managed items as handled by server ────────────────
        // Audio, video, screen, and mobile recording are all managed server-side
        // via LiveKit egress — no browser pre-registration needed.
        if (mounted) {
          setInitProgress((prev) => ({
            ...prev,
            audioRecording: true, // LiveKit composite egress captures audio
            videoRecording: true, // LiveKit composite egress captures primary cam
            screenRecording: SCREEN_SHARE_SUPPORTED ? true : "skipped",
            mobileRecording: mobileCameraConnected ? true : "skipped",
          }));
        }

        // Small delay so the user sees the "done" state before navigating
        await new Promise((r) => setTimeout(r, 400));

        console.log("✅ Pre-initialization complete (LiveKit mode)!");

        // ── 5. Bundle streams and navigate ────────────────────────────────────
        const streamPayload = {
          micStream,
          primaryCameraStream,
          screenShareStream: screenShareStreamRef.current,
          sessionData: session,
          preInitializedSocket: socket,
          // No pre-warm session IDs needed — LiveKit egress is server-managed.
          preWarmSessionIds: {},
          preWarmComplete: {
            audio: true,
            primaryCamera: true,
            screenRecording: SCREEN_SHARE_SUPPORTED,
            secondaryCamera: mobileCameraConnected,
          },
        };

        setAllStreams(streamPayload);
        Object.assign(streamsRef.current, streamPayload);

        if (mounted) {
          hasNavigatedRef.current = true;
          navigate("/interview/live", { replace: true });
        }
      } catch (err) {
        console.error("❌ Pre-initialization failed:", err);
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

    initializeInterview();
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

  /* ── CLEANUP ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (hasNavigatedRef.current) {
        settingsSocketRef.current?.disconnect();
        return;
      }
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      if (micStream) micStream.getTracks().forEach((t) => t.stop());
      if (primaryCameraStream)
        primaryCameraStream.getTracks().forEach((t) => t.stop());
      if (screenShareStream)
        screenShareStream.getTracks().forEach((t) => t.stop());
      settingsSocketRef.current?.disconnect();
      interviewSocketRef.current?.disconnect();
    };
  }, []); // eslint-disable-line

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-10 overflow-x-auto pb-2">
      {steps.map((step, idx) => {
        const done = currentStep > step.num;
        const active = currentStep === step.num;
        return (
          <div key={step.num} className="flex items-center">
            <div
              className={`flex flex-col items-center transition-all duration-300 ${active || done ? "opacity-100" : "opacity-35"}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : active
                      ? "bg-violet-600 text-white shadow-lg shadow-violet-500/40 ring-2 ring-violet-400/30 ring-offset-2 ring-offset-slate-900"
                      : "bg-slate-800 text-slate-500 border border-slate-700/60"
                }`}
              >
                {done ? (
                  <svg
                    className="w-4 h-4"
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
              <span
                className={`text-[10px] mt-1.5 font-medium tracking-wide ${active ? "text-violet-400" : done ? "text-emerald-500" : "text-slate-600"}`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-6 h-px mx-1 mb-5 transition-all duration-500 ${done ? "bg-emerald-500/60" : "bg-slate-700/60"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderBackgroundProgress = () => {
    if (currentStep === 1 || currentStep === 7) return null;
    if (!isGeneratingQuestions && questionsReady) return null;
    return (
      <div
        className={`mb-5 px-4 py-3 rounded-xl border flex items-center gap-3 transition-all duration-300 ${
          isGeneratingQuestions
            ? "bg-blue-500/8 border-blue-500/20"
            : "bg-emerald-500/8 border-emerald-500/20"
        }`}
      >
        {isGeneratingQuestions ? (
          <>
            <Spinner size="sm" color="blue" />
            <p className="text-blue-300 text-xs font-medium">
              Generating interview questions in background — you can continue
              setup freely
            </p>
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 text-emerald-400 shrink-0"
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
            <p className="text-emerald-400 text-xs font-medium">
              Questions ready
            </p>
          </>
        )}
      </div>
    );
  };

  return (
    <section
      className="min-h-screen bg-slate-950 p-4 sm:p-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%), #020617",
      }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-violet-400 text-xs font-semibold tracking-widest uppercase">
              Setup
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
            Interview Setup
          </h1>
          <p className="text-slate-500 text-sm">
            Complete each step to begin your session
          </p>
        </div>

        {renderStepIndicator()}
        {renderBackgroundProgress()}

        {error && (
          <div className="mb-5 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl flex items-start gap-3">
            <svg
              className="w-4 h-4 text-red-400 mt-0.5 shrink-0"
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
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* ── STEP 1: Skills ──────────────────────────────────────────────────── */}
        {currentStep === 1 && (
          <Card className="p-7 bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
            {!hasExistingSkills ? (
              <>
                <h2 className="text-lg font-semibold text-white mb-1">
                  Select Your Skills
                </h2>
                <p className="text-slate-500 text-sm mb-6">
                  Choose the areas you'd like to be interviewed on
                </p>
                <SkillsSelector
                  selectedSkills={skills || []}
                  onSkillsChange={(newSkills) =>
                    setValue("skills", newSkills, { shouldValidate: true })
                  }
                />
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 text-emerald-400 mb-2">
                  <svg
                    className="w-5 h-5"
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
                  <span className="font-semibold text-sm">
                    Skills Configured
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center p-4 bg-slate-800/40 rounded-xl border border-slate-700/40">
                  {user.skill.split(",").map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-violet-500/15 border border-violet-500/30 rounded-lg text-violet-300 text-sm font-medium"
                    >
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {isGeneratingQuestions && (
              <div className="mt-6 px-4 py-3 bg-blue-500/8 border border-blue-500/20 rounded-xl flex items-center gap-3">
                <Spinner size="sm" color="blue" />
                <p className="text-blue-300 text-sm">Generating questions…</p>
              </div>
            )}
            <div className="flex justify-center mt-7">
              <Button
                onClick={handleStartSetup}
                disabled={
                  (!hasExistingSkills && (!skills || skills.length === 0)) ||
                  isGeneratingQuestions
                }
                className="px-10 h-11"
              >
                {isGeneratingQuestions ? "Generating…" : "Continue"}
              </Button>
            </div>
          </Card>
        )}

        {/* ── STEP 2: Guidelines ──────────────────────────────────────────────── */}
        {currentStep === 2 && (
          <Card className="p-7 bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-1">
              Interview Guidelines
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              Please review before continuing
            </p>
            <div className="space-y-3 mb-8">
              {[
                {
                  icon: "🔇",
                  text: "Ensure you're in a quiet, well-lit environment",
                },
                {
                  icon: "👁️",
                  text: "Keep your face fully visible in the camera at all times",
                },
                {
                  icon: "🎙️",
                  text: "Speak clearly and minimise background noise",
                },
                {
                  icon: "🖥️",
                  text: "Do not switch tabs or minimise the browser window",
                },
                { icon: "💬", text: "Answer questions naturally and honestly" },
              ].map((g, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 px-4 py-3 bg-slate-800/40 rounded-xl border border-slate-700/30"
                >
                  <span className="text-base shrink-0 mt-0.5">{g.icon}</span>
                  <p className="text-slate-300 text-sm">{g.text}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <Button onClick={handleAcceptGuidelines} className="px-10 h-11">
                Accept & Continue
              </Button>
            </div>
          </Card>
        )}

        {/* ── STEP 3: Microphone ──────────────────────────────────────────────── */}
        {currentStep === 3 && (
          <Card className="p-7 bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-1">
              Microphone Check
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              Confirm your mic is picking up audio clearly
            </p>
            {!isMicTesting ? (
              <div className="text-center space-y-6 py-6">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
                  <svg
                    className="w-8 h-8 text-violet-400"
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
                <p className="text-slate-400 text-sm">
                  Speak after clicking test — the bar will show your audio level
                </p>
                <Button onClick={startMicTest} className="px-10 h-11">
                  Test Microphone
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="px-4 py-5 bg-slate-800/40 rounded-xl border border-slate-700/30">
                  <p className="text-slate-400 text-xs mb-3 text-center">
                    Speak now — watch the level rise
                  </p>
                  <div className="w-full h-5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/40">
                    <div
                      className="h-full rounded-full transition-all duration-75"
                      style={{
                        width: `${micLevel}%`,
                        background:
                          micLevel > 60
                            ? "linear-gradient(90deg,#10b981,#34d399)"
                            : micLevel > 25
                              ? "linear-gradient(90deg,#6366f1,#8b5cf6)"
                              : "linear-gradient(90deg,#475569,#64748b)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-600">0%</span>
                    <span className="text-xs text-slate-400 font-mono">
                      {Math.round(micLevel)}%
                    </span>
                    <span className="text-xs text-slate-600">100%</span>
                  </div>
                </div>
                {micLevel > 10 && (
                  <div className="flex justify-center">
                    <InfoBadge variant="green">
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
                      Microphone is working
                    </InfoBadge>
                  </div>
                )}
                <div className="flex justify-center">
                  <Button
                    onClick={handleMicSuccess}
                    disabled={micLevel < 10}
                    className="px-10 h-11"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ── STEP 4: Primary Camera ──────────────────────────────────────────── */}
        {currentStep === 4 && (
          <Card className="p-7 bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-1">
              Primary Camera
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              Make sure your face is centred and well-lit
            </p>
            {primaryCameraError ? (
              <div className="space-y-5">
                <InfoBadge variant="red">
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
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {primaryCameraError}
                </InfoBadge>
                <div className="flex justify-center">
                  <Button
                    onClick={startPrimaryCameraTest}
                    className="px-10 h-11"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : !primaryCameraStream ? (
              <div className="text-center py-12 space-y-4">
                <Spinner size="lg" color="violet" />
                <p className="text-slate-400 text-sm">
                  Requesting camera access…
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden ring-1 ring-slate-700/50">
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
                <div className="text-center space-y-4">
                  <p className="text-slate-400 text-sm">
                    Ensure your face is clearly visible and centred
                  </p>
                  <Button
                    onClick={handlePrimaryCameraSuccess}
                    className="px-10 h-11"
                  >
                    Looks Good
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ── STEP 5: Screen Share ─────────────────────────────────────────────── */}
        {currentStep === 5 && (
          <Card className="p-7 bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-1">
              Screen Sharing
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              Share your entire screen for the interview session
            </p>
            {!SCREEN_SHARE_SUPPORTED ? (
              <div className="space-y-5 text-center">
                <div className="px-4 py-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                  <p className="text-amber-300 text-sm font-medium mb-1">
                    📱 Screen sharing unavailable on mobile
                  </p>
                  <p className="text-slate-500 text-xs">
                    Use a desktop browser to enable screen recording.
                  </p>
                </div>
                <Button
                  onClick={handleScreenShareSuccess}
                  className="px-10 h-11"
                >
                  Continue Without Screen Share
                </Button>
              </div>
            ) : screenShareError ? (
              <div className="space-y-5">
                <InfoBadge variant="red">
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
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {screenShareError}
                </InfoBadge>
                <div className="flex justify-center">
                  <Button onClick={startScreenShareTest} className="px-10 h-11">
                    Try Again
                  </Button>
                </div>
              </div>
            ) : !screenShareStream ? (
              <div className="text-center space-y-6 py-6">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
                  <Spinner size="lg" color="violet" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-300 text-sm font-medium">
                    Choose what to share in the browser dialog
                  </p>
                  <p className="text-slate-500 text-xs">
                    Select your entire screen, then click Share
                  </p>
                </div>
                <button
                  onClick={startScreenShareTest}
                  className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-400 transition-colors"
                >
                  Reopen dialog
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden ring-1 ring-slate-700/50">
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
                <div className="text-center space-y-4">
                  <InfoBadge variant="green">
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
                  </InfoBadge>
                  <Button
                    onClick={handleScreenShareSuccess}
                    className="px-10 h-11"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ── STEP 6: Mobile Camera ───────────────────────────────────────────── */}
        {currentStep === 6 && (
          <Card className="p-7 bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-1 text-center">
              Mobile Camera
            </h2>
            <p className="text-slate-500 text-sm mb-6 text-center">
              Connect a secondary angle from your phone (optional)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* QR side */}
              <div className="flex flex-col items-center gap-5">
                <div className="inline-block p-3 bg-white rounded-2xl shadow-xl shadow-black/40">
                  {sessionData ? (
                    <QRCodeCanvas
                      value={`${window.location.origin}/mobile-camera?interviewId=${sessionData.interviewId}&userId=${user?.id}`}
                      size={200}
                    />
                  ) : (
                    <div className="w-50 h-50 flex items-center justify-center bg-slate-100 rounded-xl">
                      <Spinner size="lg" color="violet" />
                    </div>
                  )}
                </div>
                <div className="w-full px-4 py-3 bg-slate-800/40 rounded-xl border border-slate-700/30 space-y-2">
                  <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                    Instructions
                  </p>
                  <ol className="text-slate-400 text-xs space-y-1 list-decimal list-inside">
                    <li>Open your phone camera app</li>
                    <li>Point at the QR code above</li>
                    <li>Tap the notification banner</li>
                    <li>Grant camera permission</li>
                    <li>Position facing you from the side</li>
                  </ol>
                </div>
              </div>

              {/* Preview side */}
              <div className="flex flex-col gap-4">
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden ring-1 ring-slate-700/50">
                  {/* Canvas kept for backwards compat — blank in LiveKit mode */}
                  <canvas
                    ref={mobileCanvasRef}
                    width="640"
                    height="480"
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {!mobileCameraConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 gap-3">
                      <Spinner size="lg" color="orange" />
                      <p className="text-slate-400 text-xs">
                        Waiting for connection…
                      </p>
                      <p className="text-slate-600 text-xs">
                        Live preview available during interview
                      </p>
                    </div>
                  )}
                  {mobileCameraConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-2">
                      <div className="absolute top-3 left-3">
                        <LiveBadge color="orange" label="CONNECTED" />
                      </div>
                      <svg
                        className="w-10 h-10 text-emerald-400 mb-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-emerald-300 text-xs font-semibold">
                        Phone connected via LiveKit
                      </p>
                      <p className="text-slate-500 text-xs">
                        Live video preview appears in the interview
                      </p>
                    </div>
                  )}
                </div>

                {mobileCameraConnected ? (
                  <div className="flex flex-col items-center gap-3">
                    <InfoBadge variant="green">
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
                      Phone connected — streaming via LiveKit
                    </InfoBadge>
                    <Button
                      onClick={handleMobileCameraSuccess}
                      className="px-10 h-11 w-full"
                    >
                      Continue
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-slate-500 text-xs">
                      Waiting for your phone to connect…
                    </p>
                    <button
                      onClick={handleMobileCameraSuccess}
                      className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-400 transition-colors"
                    >
                      Skip mobile camera
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ── STEP 7: Initialization ───────────────────────────────────────────── */}
        {currentStep === 7 && (
          <Card className="p-7 bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-1 text-center">
              Launching Interview
            </h2>
            <p className="text-slate-500 text-sm mb-7 text-center">
              Finalising connections and preparing your session…
            </p>

            {initError ? (
              <div className="space-y-5">
                <div className="px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl flex items-start gap-3">
                  <svg
                    className="w-4 h-4 text-red-400 mt-0.5 shrink-0"
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
                  <p className="text-red-400 text-sm">{initError}</p>
                </div>
                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      setInitError(null);
                      setCurrentStep(6);
                    }}
                    className="px-10 h-11"
                  >
                    Go Back
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { key: "socket", label: "Connecting to server" },
                  { key: "serverReady", label: "Server ready" },
                  { key: "questions", label: "Interview questions" },
                  {
                    key: "audioRecording",
                    label: "Audio recording (via LiveKit egress)",
                  },
                  {
                    key: "videoRecording",
                    label: "Video recording (via LiveKit egress)",
                  },
                  {
                    key: "screenRecording",
                    label: SCREEN_SHARE_SUPPORTED
                      ? "Screen recording (via LiveKit egress)"
                      : "Screen recording (desktop only)",
                  },
                  {
                    key: "mobileRecording",
                    label: `Mobile recording${!mobileCameraConnected ? " (optional)" : " (via LiveKit egress)"}`,
                  },
                ].map(({ key, label }) => {
                  const status = initProgress[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl border transition-all duration-300 ${
                        status === true
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : ["connecting", "waiting", "starting"].includes(
                                status,
                              )
                            ? "bg-violet-500/8 border-violet-500/20"
                            : ["skipped", "optional", "na"].includes(status)
                              ? "bg-slate-800/30 border-slate-700/30"
                              : "bg-slate-800/20 border-slate-700/20"
                      }`}
                    >
                      <StatusIcon status={status} />
                      <span
                        className={`text-sm font-medium ${
                          status === true
                            ? "text-emerald-300"
                            : ["connecting", "waiting", "starting"].includes(
                                  status,
                                )
                              ? "text-violet-300"
                              : ["skipped", "optional", "na"].includes(status)
                                ? "text-slate-600"
                                : "text-slate-500"
                        }`}
                      >
                        {label}
                      </span>
                      {["connecting", "waiting", "starting"].includes(
                        status,
                      ) && (
                        <span className="ml-auto text-[10px] text-violet-500 font-medium animate-pulse">
                          {status === "connecting"
                            ? "connecting…"
                            : status === "waiting"
                              ? "waiting…"
                              : "starting…"}
                        </span>
                      )}
                      {status === true && (
                        <span className="ml-auto text-[10px] text-emerald-600 font-medium">
                          done
                        </span>
                      )}
                      {["skipped", "na"].includes(status) && (
                        <span className="ml-auto text-[10px] text-slate-600 font-medium">
                          server-managed
                        </span>
                      )}
                    </div>
                  );
                })}

                <div className="flex justify-center pt-4">
                  <InfoBadge variant="blue">
                    <Spinner size="sm" color="blue" />
                    Almost ready — please wait…
                  </InfoBadge>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </section>
  );
};

export default InterviewSetup;
