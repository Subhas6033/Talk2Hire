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

const SOCKET_URL = import.meta.env.VITE_WS_URL;

// getDisplayMedia is desktop-only — not available on Android/iOS browsers
const IS_MOBILE =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
const SCREEN_SHARE_SUPPORTED =
  !IS_MOBILE && !!navigator.mediaDevices?.getDisplayMedia;

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
    { num: 4, label: "Primary Camera" },
    { num: 5, label: "Mobile Camera" },
    { num: 6, label: "Screen Share" },
    { num: 7, label: "Initializing" },
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

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [mobileCameraConnected, setMobileCameraConnected] = useState(false);
  const [mobileFramesReceived, setMobileFramesReceived] = useState(0);

  const [screenShareStream, setScreenShareStream] = useState(null);
  const [screenShareError, setScreenShareError] = useState(null);
  // Ref keeps the live stream value accessible inside async closures without
  // needing screenShareStream in the step-7 effect dependency array.
  const screenShareStreamRef = useRef(null);

  const [initProgress, setInitProgress] = useState({
    socket: false,
    serverReady: false,
    audioRecording: false,
    videoRecording: false,
    screenRecording: false,
    mobileRecording: false,
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

  const hasExistingSkills = user?.skill?.trim();

  /* ── STEP HANDLERS ─────────────────────────────────────────────────────── */

  const handleStartSetup = () => {
    if (!hasExistingSkills && (!skills || skills.length === 0)) {
      setError("Please select at least one skill.");
      return;
    }

    setError(null);

    if (!questionStartedRef.current) {
      questionStartedRef.current = true;
      setIsGeneratingQuestions(true);

      dispatch(
        startInterview({
          skills: !hasExistingSkills ? skills : undefined,
        }),
      )
        .unwrap()
        .then((res) => {
          if (!res?.sessionId) throw new Error("No session id");

          setSessionData({
            interviewId: res.sessionId,
            userId: user.id,
          });

          setQuestionsReady(true);
          setCurrentStep(2);
        })
        .catch(() => {
          setError("Failed to generate questions.");
          questionStartedRef.current = false;
        })
        .finally(() => {
          setIsGeneratingQuestions(false);
        });
    }
  };

  const handleAcceptGuidelines = () => {
    if (!sessionData) {
      setError("Session not ready yet. Please wait a moment.");
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
    micTestCleanupRef.current = true;
    analyserRef.current = null;
    setError(null);
    setCurrentStep(4);
  };

  const handlePrimaryCameraSuccess = () => {
    setError(null);
    setCurrentStep(5);
  };

  const handleMobileCameraSuccess = () => {
    setError(null);
    setCurrentStep(6);
  };

  const handleScreenShareSuccess = () => {
    const isMicActive = micStream?.active;
    const isCameraActive = primaryCameraStream?.active;
    // On mobile, screen share is not supported — treat it as always active
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

    if (isGeneratingQuestions) {
      setError(
        "Questions are still generating. Please wait a moment and try again.",
      );
      return;
    }

    if (!questionsReady) {
      setError("Questions are not ready yet. Please wait.");
      return;
    }

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

      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }

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
        const level = Math.min(100, (avg / 128) * 100);
        setMicLevel(level);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.error("❌ Microphone error:", err);
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
      console.error("Camera error:", err);
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

  /* ── MOBILE CAMERA SOCKET ───────────────────────────────────────────────── */

  useEffect(() => {
    if (currentStep !== 5 || !sessionData) return;

    const socket = io(SOCKET_URL, {
      query: {
        interviewId: sessionData.interviewId,
        userId: sessionData.userId,
        type: "settings",
      },
    });

    settingsSocketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Settings socket connected:", socket.id);
    });

    socket.on("secondary_camera_ready", () => {
      console.log("✅ Mobile camera connected");
      setMobileCameraConnected(true);
    });

    socket.on("mobile_camera_frame", (data) => {
      if (!data?.frame || !mobileCanvasRef.current) return;
      const img = new Image();
      img.onload = () => {
        const ctx = mobileCanvasRef.current.getContext("2d");
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

    socket.on("connect_error", (err) => {
      console.error("Settings socket error:", err);
      setError("Failed to connect to server for mobile camera.");
    });

    return () => {
      console.log("🧹 Disconnecting settings socket");
      socket.disconnect();
    };
  }, [currentStep, sessionData]);

  /* ── SCREEN SHARE ───────────────────────────────────────────────────────── */

  const startScreenShareTest = async () => {
    // Mobile browsers don't support getDisplayMedia — skip silently
    if (!SCREEN_SHARE_SUPPORTED) {
      console.log(
        "📱 Screen share not supported on this device — skipping step",
      );
      return;
    }

    try {
      setScreenShareError(null);

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setScreenShareStream(stream);
      screenShareStreamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      track.addEventListener("ended", () => {
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
      console.error("Screen share error:", err);
      setScreenShareError("Screen share denied or cancelled.");
    }
  };

  useEffect(() => {
    if (currentStep === 6) startScreenShareTest();
  }, [currentStep]);

  /* ── PRE-INITIALIZATION (STEP 7) ────────────────────────────────────────── */
  // KEY FIX: We now capture the videoId/audioId returned from each
  // registration and store them in streamsRef.current.preWarmSessionIds.
  // InterviewLive reads these to RESUME the same sessions rather than
  // creating new ones — eliminating the duplicate-session conflict that
  // caused screen/secondary recording to fail and TTS to lag on startup.

  useEffect(() => {
    if (currentStep !== 7 || !sessionData) return;

    let mounted = true;
    let socket = null;

    const registerVideoSession = (
      videoType,
      timeoutMs = 15000,
      optional = false,
    ) =>
      new Promise((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          socket.off("video_recording_ready", onReady);
          socket.off("video_recording_error", onError);
        };

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          const msg = `${videoType} registration timeout`;
          console.warn("⚠️", msg);
          if (optional) resolve({ timedOut: true });
          else reject(new Error(msg));
        }, timeoutMs);

        const onReady = (data) => {
          if (data.videoType !== videoType) return;
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanup();
          console.log(`✅ ${videoType} REGISTERED: videoId=${data.videoId}`);
          resolve(data); // data.videoId is the pre-warm session ID we need
        };

        const onError = (err) => {
          if (err?.videoType && err.videoType !== videoType) return;
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanup();
          const msg = err?.error || `${videoType} registration failed`;
          console.error(`❌ ${videoType} error:`, msg);
          if (optional) resolve({ error: msg });
          else reject(new Error(msg));
        };

        socket.on("video_recording_ready", onReady);
        socket.on("video_recording_error", onError);

        socket.emit("video_recording_start", {
          videoType,
          totalChunks: 0,
          metadata: { mimeType: "video/webm;codecs=vp9" },
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
          setupMode: true,
        });
      });

    const registerAudioSession = () =>
      new Promise((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          socket.off("audio_recording_ready", onReady);
          socket.off("audio_recording_error", onError);
        };

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error("Audio recording registration timeout"));
        }, 15000);

        const onReady = (data) => {
          if (data.audioType !== "mixed_audio") return;
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanup();
          console.log("✅ Audio REGISTERED: audioId=", data.audioId);
          resolve(data); // data.audioId is the pre-warm session ID we need
        };

        const onError = (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanup();
          reject(new Error(err?.error || "Audio registration failed"));
        };

        socket.on("audio_recording_ready", onReady);
        socket.on("audio_recording_error", onError);

        socket.emit("audio_recording_start", {
          audioType: "mixed_audio",
          metadata: { sampleRate: 48000 },
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
          setupMode: true,
        });
      });

    const initializeInterview = async () => {
      try {
        console.log("🔄 Starting pre-initialization...");

        if (settingsSocketRef.current?.connected) {
          console.log("🧹 Disconnecting settings socket");
          settingsSocketRef.current.disconnect();
          settingsSocketRef.current = null;
          await new Promise((r) => setTimeout(r, 300));
        }

        setInitProgress((prev) => ({ ...prev, socket: "connecting" }));

        socket = io(SOCKET_URL, {
          query: {
            interviewId: sessionData.interviewId,
            userId: sessionData.userId,
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
            console.log("✅ Socket connected:", socket.id);
            socket.emit("setup_mode", {
              setupInProgress: true,
              interviewId: sessionData.interviewId,
              userId: sessionData.userId,
            });
            if (mounted) setInitProgress((prev) => ({ ...prev, socket: true }));
            resolve();
          });
          socket.once("connect_error", (err) => {
            clearTimeout(timer);
            reject(err);
          });
        });

        setInitProgress((prev) => ({ ...prev, serverReady: "waiting" }));
        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Server ready timeout")),
            20000,
          );
          socket.once("server_ready", () => {
            clearTimeout(timer);
            console.log("✅ Server ready");
            if (mounted)
              setInitProgress((prev) => ({ ...prev, serverReady: true }));
            resolve();
          });
        });

        console.log("📝 Registering recording sessions (isolated handlers)");

        // ── Audio — capture audioId for InterviewLive to reuse ────────────────
        setInitProgress((prev) => ({ ...prev, audioRecording: "starting" }));
        const audioResult = await registerAudioSession();
        if (mounted) {
          setInitProgress((prev) => ({ ...prev, audioRecording: true }));
          // KEY FIX: Store pre-warmed session ID
          streamsRef.current.preWarmSessionIds.audioId =
            audioResult.audioId ?? null;
          streamsRef.current.preWarmComplete.audio = true;
          console.log("📦 Stored pre-warm audioId:", audioResult.audioId);
        }

        // ── Primary camera — capture videoId for InterviewLive to reuse ───────
        setInitProgress((prev) => ({ ...prev, videoRecording: "starting" }));
        const primaryResult = await registerVideoSession("primary_camera");
        if (mounted) {
          setInitProgress((prev) => ({ ...prev, videoRecording: true }));
          // KEY FIX: Store pre-warmed session ID
          streamsRef.current.preWarmSessionIds.primaryCameraId =
            primaryResult.videoId ?? null;
          streamsRef.current.preWarmComplete.primaryCamera = true;
          console.log(
            "📦 Stored pre-warm primaryCameraId:",
            primaryResult.videoId,
          );
        }

        // ── Screen recording — skip on mobile (getDisplayMedia not supported) ──
        if (SCREEN_SHARE_SUPPORTED) {
          setInitProgress((prev) => ({ ...prev, screenRecording: "starting" }));
          const screenResult = await registerVideoSession("screen_recording");
          if (mounted) {
            setInitProgress((prev) => ({ ...prev, screenRecording: true }));
            streamsRef.current.preWarmSessionIds.screenRecordingId =
              screenResult.videoId ?? null;
            streamsRef.current.preWarmComplete.screenRecording = true;
            console.log(
              "📦 Stored pre-warm screenRecordingId:",
              screenResult.videoId,
            );
          }
        } else {
          // Mobile — no screen recording session needed
          setInitProgress((prev) => ({ ...prev, screenRecording: "skipped" }));
          console.log("📱 Screen recording skipped (mobile)");
        }

        // ── Mobile (optional) ─────────────────────────────────────────────────
        if (mobileCameraConnected) {
          setInitProgress((prev) => ({ ...prev, mobileRecording: "starting" }));
          const secondaryResult = await registerVideoSession(
            "secondary_camera",
            10000,
            true,
          );
          if (mounted) {
            const succeeded =
              !secondaryResult?.timedOut && !secondaryResult?.error;
            setInitProgress((prev) => ({
              ...prev,
              mobileRecording: succeeded ? true : "optional",
            }));
            if (succeeded) {
              // KEY FIX: Store pre-warmed session ID
              streamsRef.current.preWarmSessionIds.secondaryCameraId =
                secondaryResult.videoId ?? null;
              streamsRef.current.preWarmComplete.secondaryCamera = true;
              console.log(
                "📦 Stored pre-warm secondaryCameraId:",
                secondaryResult.videoId,
              );
            }
          }
        } else {
          setInitProgress((prev) => ({ ...prev, mobileRecording: "skipped" }));
        }

        console.log("✅ Pre-initialization complete!");

        // ── Store everything in context for InterviewLive ─────────────────────
        streamsRef.current.micStream = micStream;
        streamsRef.current.primaryCameraStream = primaryCameraStream;
        streamsRef.current.screenShareStream = screenShareStreamRef.current;
        streamsRef.current.sessionData = sessionData;
        streamsRef.current.preInitializedSocket = socket;

        if (mounted) {
          hasNavigatedRef.current = true;
          console.log("🚀 Navigating to /interview/live");
          navigate("/interview/live", { replace: true });
        }
      } catch (error) {
        console.error("❌ Pre-initialization failed:", error);
        if (mounted) {
          setInitError(error.message);
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
    sessionData,
    mobileCameraConnected,
    micStream,
    primaryCameraStream,
    // screenShareStream intentionally omitted — we use screenShareStreamRef
    // to avoid re-running this effect when the stream state changes.
    navigate,
    streamsRef,
  ]);

  /* ── CLEANUP ─────────────────────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (hasNavigatedRef.current) {
        console.log("✅ Navigation successful, streams preserved in context");
        if (settingsSocketRef.current?.connected) {
          settingsSocketRef.current.disconnect();
        }
        return;
      }

      console.log("🧹 Cleaning up streams (setup cancelled)");

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
  }, []);

  /* ── RENDER ────────────────────────────────────────────────────────────── */

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-4">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          <div
            className={`flex flex-col items-center ${currentStep >= step.num ? "opacity-100" : "opacity-40"}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep > step.num
                  ? "bg-green-500 text-white"
                  : currentStep === step.num
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-400"
              }`}
            >
              {currentStep > step.num ? "✓" : step.num}
            </div>
            <span className="text-xs mt-1 text-gray-400">{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className="w-8 h-0.5 mx-2 mb-4 bg-gray-700" />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <section className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Interview Setup
          </h1>
          <p className="text-gray-400">
            Complete all steps to start your interview
          </p>
        </div>

        {renderStepIndicator()}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {isGeneratingQuestions && currentStep > 1 && currentStep < 7 && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full" />
              <p className="text-blue-300 text-sm">
                Generating interview questions in the background…
              </p>
            </div>
          </div>
        )}

        {/* STEP 1: Skills */}
        {currentStep === 1 && (
          <Card className="p-8">
            {!hasExistingSkills ? (
              <>
                <h2 className="text-xl font-bold text-white mb-6">
                  Select Your Skills
                </h2>
                <SkillsSelector
                  selectedSkills={skills || []}
                  onSkillsChange={(newSkills) =>
                    setValue("skills", newSkills, { shouldValidate: true })
                  }
                />
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-500 mb-4">
                  <svg
                    className="w-6 h-6"
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
                  <span className="font-semibold">Skills Configured</span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center p-4 bg-white/5 rounded-lg border border-white/10">
                  {user.skill.split(",").map((skill, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 bg-purple-500/20 border border-purple-500 rounded-lg text-purple-300 text-sm font-medium"
                    >
                      {skill.trim()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isGeneratingQuestions && (
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full" />
                  <p className="text-blue-300 text-sm">
                    Generating questions...
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-center mt-8">
              <Button
                onClick={handleStartSetup}
                disabled={
                  (!hasExistingSkills && (!skills || skills.length === 0)) ||
                  isGeneratingQuestions
                }
                className="px-10"
              >
                {isGeneratingQuestions ? "Generating..." : "Continue"}
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 2: Guidelines */}
        {currentStep === 2 && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-white mb-6">
              Interview Guidelines
            </h2>
            <div className="space-y-4 text-gray-300 text-sm mb-8">
              {[
                "Ensure you're in a quiet, well-lit environment",
                "Keep your face visible in the camera at all times",
                "Speak clearly and avoid background noise",
                "Do not switch tabs or minimize the browser",
                "Answer questions naturally and honestly",
              ].map((guideline, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-purple-500 shrink-0 mt-0.5"
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
                  <p>{guideline}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <Button onClick={handleAcceptGuidelines} className="px-10">
                Accept and Continue
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 3: Microphone */}
        {currentStep === 3 && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-white mb-6">
              Microphone Check
            </h2>
            {!isMicTesting ? (
              <div className="text-center space-y-6">
                <p className="text-gray-400">
                  Test your microphone for clear audio
                </p>
                <Button onClick={startMicTest} className="px-10">
                  Test Microphone
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-gray-400 mb-4">
                    Speak to see the level bar move
                  </p>
                  <div className="w-full h-8 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-green-500 to-emerald-500 transition-all duration-100"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Level: {Math.round(micLevel)}%
                  </p>
                </div>
                {micLevel > 10 && (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg mb-4">
                      <svg
                        className="w-5 h-5 text-green-500"
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
                      <span className="text-green-400 text-sm font-medium">
                        Microphone working!
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-center">
                  <Button
                    onClick={handleMicSuccess}
                    disabled={micLevel < 10}
                    className="px-10"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* STEP 4: Primary Camera */}
        {currentStep === 4 && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-white mb-6">
              Primary Camera
            </h2>
            {primaryCameraError ? (
              <div className="space-y-6">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm text-center">
                    {primaryCameraError}
                  </p>
                </div>
                <div className="flex justify-center">
                  <Button onClick={startPrimaryCameraTest} className="px-10">
                    Try Again
                  </Button>
                </div>
              </div>
            ) : !primaryCameraStream ? (
              <div className="text-center space-y-6">
                <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto" />
                <p className="text-gray-400">Accessing camera...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                  <video
                    ref={primaryVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <div className="absolute top-4 left-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/90 backdrop-blur-sm rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="text-white text-xs font-bold">LIVE</span>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 mb-4">
                    Make sure your face is visible
                  </p>
                  <Button
                    onClick={handlePrimaryCameraSuccess}
                    className="px-10"
                  >
                    Looks Good
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* STEP 5: Mobile Camera */}
        {currentStep === 5 && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-white mb-6 text-center">
              Connect Mobile Camera
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Scan with Phone
                  </h3>
                  <div className="inline-block p-4 bg-white rounded-2xl mx-auto">
                    {sessionData ? (
                      <QRCodeCanvas
                        value={`${window.location.origin}/mobile-camera?interviewId=${sessionData.interviewId}&userId=${user?.id}`}
                        size={256}
                      />
                    ) : (
                      <div className="w-64 h-64 flex items-center justify-center bg-gray-700 rounded-2xl">
                        <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-400 space-y-2">
                  <p className="font-semibold text-white">Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Open phone camera</li>
                    <li>Point at QR code</li>
                    <li>Tap notification</li>
                    <li>Grant camera permission</li>
                    <li>Position front camera</li>
                  </ol>
                </div>
              </div>
              <div className="space-y-4">
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                  <canvas
                    ref={mobileCanvasRef}
                    width="640"
                    height="480"
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {!mobileCameraConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                      <div className="animate-spin w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full mb-4" />
                      <p className="text-white text-sm">Waiting...</p>
                    </div>
                  )}
                  {mobileCameraConnected && (
                    <div className="absolute top-4 left-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/90 backdrop-blur-sm rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span className="text-white text-xs font-bold">
                          CONNECTED
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-center">
                  {mobileCameraConnected ? (
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                        <svg
                          className="w-5 h-5 text-green-500"
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
                        <span className="text-green-400 text-sm font-medium">
                          Connected! ({mobileFramesReceived} frames)
                        </span>
                      </div>
                      <Button
                        onClick={handleMobileCameraSuccess}
                        className="px-10"
                      >
                        Continue
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-gray-400 text-sm">
                        Waiting for connection...
                      </p>
                      <button
                        onClick={handleMobileCameraSuccess}
                        className="text-xs text-gray-500 underline hover:text-gray-300"
                      >
                        Skip mobile camera
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 6: Screen Share */}
        {currentStep === 6 && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-white mb-6">
              Screen Sharing
            </h2>
            {/* Mobile browsers don't support getDisplayMedia — show skip UI */}
            {!SCREEN_SHARE_SUPPORTED ? (
              <div className="space-y-6 text-center">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <p className="text-yellow-300 text-sm font-medium mb-1">
                    📱 Screen sharing is not supported on mobile browsers
                  </p>
                  <p className="text-gray-400 text-xs">
                    Please use a desktop browser (Chrome, Edge, or Firefox) to
                    enable screen recording. You can continue without it.
                  </p>
                </div>
                <Button onClick={handleScreenShareSuccess} className="px-10">
                  Continue Without Screen Share
                </Button>
              </div>
            ) : screenShareError ? (
              <div className="space-y-6">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm text-center">
                    {screenShareError}
                  </p>
                </div>
                <div className="flex justify-center">
                  <Button onClick={startScreenShareTest} className="px-10">
                    Try Again
                  </Button>
                </div>
              </div>
            ) : !screenShareStream ? (
              <div className="text-center space-y-6">
                <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto" />
                <p className="text-gray-400">Starting screen share...</p>
                <p className="text-sm text-gray-500">
                  Select your entire screen
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 left-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/90 backdrop-blur-sm rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="text-white text-xs font-bold">
                        SHARING
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                    <svg
                      className="w-5 h-5 text-green-500"
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
                    <span className="text-green-400 text-sm font-medium">
                      Screen share ready!
                    </span>
                  </div>

                  {isGeneratingQuestions && (
                    <div className="flex items-center justify-center gap-2 text-blue-300 text-sm">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full" />
                      <span>Questions still generating, please wait…</span>
                    </div>
                  )}

                  <p className="text-gray-400 text-sm">
                    Click continue to initialize the interview
                  </p>

                  <Button
                    onClick={handleScreenShareSuccess}
                    className="px-10"
                    disabled={isGeneratingQuestions}
                  >
                    {isGeneratingQuestions
                      ? "Waiting for questions…"
                      : "Continue"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* STEP 7: Initialization */}
        {currentStep === 7 && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-white mb-6 text-center">
              Initializing Interview
            </h2>
            {initError ? (
              <div className="space-y-6">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm text-center">
                    {initError}
                  </p>
                </div>
                <div className="flex justify-center">
                  <Button onClick={() => setCurrentStep(6)} className="px-10">
                    Go Back
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-center text-gray-400 mb-8">
                  Setting up audio, video, and connections...
                </p>
                <div className="space-y-4">
                  {[
                    { key: "socket", label: "Connecting to server" },
                    { key: "serverReady", label: "Server ready" },
                    { key: "audioRecording", label: "Audio recording" },
                    { key: "videoRecording", label: "Video recording" },
                    { key: "screenRecording", label: "Screen recording" },
                    {
                      key: "mobileRecording",
                      label: `Mobile recording ${!mobileCameraConnected ? "(optional)" : ""}`,
                    },
                  ].map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center gap-4 p-4 bg-white/5 rounded-lg"
                    >
                      {initProgress[key] === true ? (
                        <svg
                          className="w-6 h-6 text-green-500 shrink-0"
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
                      ) : ["connecting", "waiting", "starting"].includes(
                          initProgress[key],
                        ) ? (
                        <div className="animate-spin w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full shrink-0" />
                      ) : ["skipped", "optional"].includes(
                          initProgress[key],
                        ) ? (
                        <svg
                          className="w-6 h-6 text-gray-500 shrink-0"
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
                      ) : (
                        <div className="w-6 h-6 border-2 border-gray-600 rounded-full shrink-0" />
                      )}
                      <span className="text-white font-medium">{label}</span>
                    </div>
                  ))}
                </div>
                <div className="text-center pt-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full" />
                    <span className="text-blue-300 text-sm font-medium">
                      Please wait while we prepare everything...
                    </span>
                  </div>
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
