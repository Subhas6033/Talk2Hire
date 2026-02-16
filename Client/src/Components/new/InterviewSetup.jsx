import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { Card } from "../Common/Card";
import { Button, SkillsSelector } from "../index";
import { startInterview } from "../../API/interviewApi";
import QRCode from "qrcode";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

const InterviewSetup = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const { watch, setValue, handleSubmit } = useForm({
    mode: "onChange",
    defaultValues: { skills: [] },
  });

  const skills = watch("skills");

  // Setup states
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState(null);

  // Question generation states
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsReady, setQuestionsReady] = useState(false);
  const [sessionData, setSessionData] = useState(null);

  // Microphone states
  const [micStream, setMicStream] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [isMicTesting, setIsMicTesting] = useState(false);

  // Primary camera states
  const [primaryCameraStream, setPrimaryCameraStream] = useState(null);
  const [primaryCameraError, setPrimaryCameraError] = useState(null);

  // Mobile camera states
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [mobileCameraConnected, setMobileCameraConnected] = useState(false);
  const [mobileFramesReceived, setMobileFramesReceived] = useState(0);

  // Screen share states
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [screenShareError, setScreenShareError] = useState(null);

  // Refs
  const primaryVideoRef = useRef(null);
  const mobileCanvasRef = useRef(null);
  const screenVideoRef = useRef(null);
  const settingsSocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const questionGenerationStartedRef = useRef(false);
  const socketInitializedRef = useRef(false);

  const hasExistingSkills = user?.skill && user.skill.trim() !== "";

  useEffect(() => {
    if (hasExistingSkills) {
      const skillsArray = user.skill
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setValue("skills", skillsArray);
    }
  }, [user, hasExistingSkills, setValue]);

  // STEP 1: Start question generation
  const handleStartSetup = async () => {
    if (!hasExistingSkills && (!skills || skills.length === 0)) {
      setError("Please select at least one skill to continue.");
      return;
    }

    if (!user?.id) {
      setError("User not authenticated.");
      return;
    }

    setError(null);

    if (!questionGenerationStartedRef.current) {
      questionGenerationStartedRef.current = true;
      setIsGeneratingQuestions(true);

      try {
        console.log("Starting question generation...");
        const result = await dispatch(
          startInterview({
            skills: !hasExistingSkills ? skills : undefined,
          }),
        ).unwrap();

        if (!result?.sessionId) {
          throw new Error("Session ID not returned from server");
        }

        const newSessionData = {
          interviewId: result.sessionId,
          userId: user.id,
        };

        console.log("Questions generated:", newSessionData);
        setSessionData(newSessionData);
        setQuestionsReady(true);
        setIsGeneratingQuestions(false);
      } catch (err) {
        console.error("Question generation error:", err);
        setError(err?.message || "Failed to generate interview questions");
        setIsGeneratingQuestions(false);
        questionGenerationStartedRef.current = false;
        return;
      }
    }

    setCurrentStep(2);
  };

  // STEP 2: Accept guidelines
  const handleAcceptGuidelines = () => {
    setCurrentStep(3);
  };

  // STEP 3: Microphone test
  const startMicTest = async () => {
    try {
      setIsMicTesting(true);
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setMicStream(stream);

      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const level = Math.min(100, (average / 128) * 100);
        setMicLevel(level);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
      console.log("Microphone test started");
    } catch (err) {
      console.error("Microphone error:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow access and try again."
          : "Failed to access microphone: " + err.message,
      );
      setIsMicTesting(false);
    }
  };

  const handleMicSuccess = () => {
    setCurrentStep(4);
  };

  // STEP 4: Primary camera test
  const startPrimaryCameraTest = async () => {
    try {
      setPrimaryCameraError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      setPrimaryCameraStream(stream);

      if (primaryVideoRef.current) {
        primaryVideoRef.current.srcObject = stream;
        await primaryVideoRef.current.play();
      }

      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.addEventListener(
        "ended",
        () => {
          setPrimaryCameraError("Camera track ended unexpectedly");
          console.error("Primary camera track ended!");
        },
        { once: true },
      );

      console.log("Primary camera started");
    } catch (err) {
      console.error("Primary camera error:", err);
      setPrimaryCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow access and try again."
          : "Failed to access camera: " + err.message,
      );
    }
  };

  useEffect(() => {
    if (currentStep === 4 && !primaryCameraStream) {
      startPrimaryCameraTest();
    }
  }, [currentStep]);

  const handlePrimaryCameraSuccess = () => {
    setCurrentStep(5);
  };

  // STEP 5: Mobile camera setup
  const generateQRCode = async () => {
    if (!sessionData?.interviewId || !user?.id) {
      setError("Session not ready. Please try again.");
      return;
    }

    try {
      const mobileUrl = `${window.location.origin}/mobile-camera?mobile=true&interviewId=${sessionData.interviewId}&userId=${user.id}`;
      console.log("Generating QR code for:", mobileUrl);

      const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
        width: 280,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      setQrCodeDataUrl(qrDataUrl);
      console.log("QR code generated");
    } catch (err) {
      console.error("QR code generation error:", err);
      setError("Failed to generate QR code");
    }
  };

  const initializeSocket = async () => {
    if (socketInitializedRef.current || !sessionData) return;

    socketInitializedRef.current = true;

    try {
      console.log("Initializing socket...");
      const socket = io(SOCKET_URL, {
        query: {
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
          type: "settings",
        },
        transports: ["websocket", "polling"],
        path: "/socket.io",
        reconnection: true,
        reconnectionAttempts: 5,
        autoConnect: true,
      });

      settingsSocketRef.current = socket;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Socket connection timeout"));
        }, 10000);

        socket.once("connect", () => {
          clearTimeout(timeout);
          console.log("Settings socket connected:", socket.id);
          resolve();
        });

        socket.on("connect_error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      socket.on("secondary_camera_ready", (data) => {
        console.log("Mobile camera confirmed:", data);
        setMobileCameraConnected(true);
      });

      socket.on("secondary_camera_status", (data) => {
        if (data.connected) {
          setMobileCameraConnected(true);
        }
      });

      if (mobileCanvasRef.current) {
        const canvas = mobileCanvasRef.current;
        canvas.width = 640;
        canvas.height = 480;
      }

      socket.on("mobile_camera_frame", (data) => {
        if (!data?.frame || !mobileCanvasRef.current) return;

        const canvas = mobileCanvasRef.current;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
          try {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              if (
                canvas.width !== img.naturalWidth ||
                canvas.height !== img.naturalHeight
              ) {
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
              }
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setMobileFramesReceived((prev) => prev + 1);
          } catch (error) {
            console.error("Canvas draw error:", error);
          }
        };
        img.src = data.frame;
      });

      socket.emit("request_secondary_camera_status", {
        interviewId: sessionData.interviewId,
      });

      await generateQRCode();
    } catch (err) {
      console.error("Socket initialization error:", err);
      setError(err?.message || "Failed to initialize connection");
      socketInitializedRef.current = false;
    }
  };

  useEffect(() => {
    if (currentStep === 5 && questionsReady && sessionData) {
      initializeSocket();
    }
  }, [currentStep, questionsReady, sessionData]);

  const handleMobileCameraSuccess = () => {
    setCurrentStep(6);
  };

  // STEP 6: Screen share test
  const startScreenShareTest = async () => {
    try {
      setScreenShareError(null);

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          cursor: "always",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setScreenShareStream(stream);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        await screenVideoRef.current.play();
      }

      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.addEventListener(
        "ended",
        () => {
          setScreenShareError("Screen sharing stopped");
        },
        { once: true },
      );

      console.log("Screen share started");
    } catch (err) {
      console.error("Screen share error:", err);
      setScreenShareError(
        err.name === "NotAllowedError"
          ? "Screen sharing permission denied."
          : "Failed to start screen sharing: " + err.message,
      );
    }
  };

  useEffect(() => {
    if (currentStep === 6 && !screenShareStream) {
      startScreenShareTest();
    }
  }, [currentStep]);

  const handleStartInterview = () => {
    if (!questionsReady || !sessionData) {
      setError("Interview questions not ready.");
      return;
    }

    if (!micStream) {
      setError("Microphone not configured.");
      return;
    }

    if (!primaryCameraStream) {
      setError("Primary camera not configured.");
      return;
    }

    if (!mobileCameraConnected) {
      setError("Mobile camera not connected.");
      return;
    }

    if (!screenShareStream) {
      setError("Screen sharing not started.");
      return;
    }

    const primaryTrack = primaryCameraStream.getVideoTracks()[0];
    if (primaryTrack.readyState !== "live") {
      setError("Primary camera is not active.");
      return;
    }

    const screenTrack = screenShareStream.getVideoTracks()[0];
    if (screenTrack.readyState !== "live") {
      setError("Screen sharing is not active.");
      return;
    }

    console.log("All checks passed - starting interview");

    if (settingsSocketRef.current) {
      settingsSocketRef.current.disconnect();
      settingsSocketRef.current = null;
    }

    navigate("/interview/live", {
      state: {
        sessionData,
        micStream,
        primaryCameraStream,
        screenShareStream,
      },
    });
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (settingsSocketRef.current) {
        settingsSocketRef.current.disconnect();
      }

      if (currentStep < 7) {
        if (micStream) {
          micStream.getTracks().forEach((track) => track.stop());
        }
        if (primaryCameraStream) {
          primaryCameraStream.getTracks().forEach((track) => track.stop());
        }
        if (screenShareStream) {
          screenShareStream.getTracks().forEach((track) => track.stop());
        }
      }
    };
  }, [currentStep]);

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: "Skills" },
      { num: 2, label: "Guidelines" },
      { num: 3, label: "Microphone" },
      { num: 4, label: "Camera" },
      { num: 5, label: "Mobile" },
      { num: 6, label: "Screen" },
    ];

    return (
      <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-4">
        {steps.map((step, idx) => (
          <div key={step.num} className="flex items-center">
            <div
              className={`flex flex-col items-center ${
                currentStep >= step.num ? "opacity-100" : "opacity-40"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  currentStep > step.num
                    ? "bg-green-500 text-white"
                    : currentStep === step.num
                      ? "bg-purple-600 text-white ring-4 ring-purple-600/30"
                      : "bg-gray-700 text-gray-400"
                }`}
              >
                {currentStep > step.num ? "✓" : step.num}
              </div>
              <span className="text-xs mt-1 text-gray-400 whitespace-nowrap">
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-2 mb-4 transition-all ${
                  currentStep > step.num ? "bg-green-500" : "bg-gray-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="min-h-screen bg-linear-to-br from-gray-900 to-gray-800 p-4 md:p-6">
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

            {!questionsReady && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full" />
                  <p className="text-blue-300 text-sm">
                    Preparing questions...
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <Button
                onClick={handleAcceptGuidelines}
                disabled={!questionsReady}
                className="px-10"
              >
                {questionsReady ? "Accept & Continue" : "Waiting..."}
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
                  {qrCodeDataUrl ? (
                    <div className="inline-block p-4 bg-white rounded-2xl">
                      <img
                        src={qrCodeDataUrl}
                        alt="QR Code"
                        className="w-64 h-64"
                      />
                    </div>
                  ) : (
                    <div className="w-72 h-72 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto">
                      <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full" />
                    </div>
                  )}
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
                    <p className="text-gray-400 text-sm">Waiting...</p>
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

            {screenShareError ? (
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
                      All setup complete!
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm">
                    Ready to start your interview
                  </p>

                  <Button onClick={handleStartInterview} className="px-10">
                    Start Interview
                  </Button>
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
