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

  const { watch, setValue } = useForm({
    mode: "onChange",
    defaultValues: { skills: [] },
  });

  const skills = watch("skills");

  /* ================= STEPS ================= */

  const steps = [
    { num: 1, label: "Skills" },
    { num: 2, label: "Guidelines" },
    { num: 3, label: "Microphone" },
    { num: 4, label: "Primary Camera" },
    { num: 5, label: "Mobile Camera" },
    { num: 6, label: "Screen Share" },
  ];

  /* ================= STATE ================= */

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

  /* ================= REFS ================= */

  const primaryVideoRef = useRef(null);
  const mobileCanvasRef = useRef(null);
  const screenVideoRef = useRef(null);
  const settingsSocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const questionStartedRef = useRef(false);
  const hasNavigatedRef = useRef(false);

  const hasExistingSkills = user?.skill?.trim();

  /* ================= STEP 1 ================= */

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

  const handleAcceptGuidelines = () => setCurrentStep(3);
  const handleMicSuccess = () => setCurrentStep(4);
  const handlePrimaryCameraSuccess = () => setCurrentStep(5);
  const handleMobileCameraSuccess = () => setCurrentStep(6);

  /* ================= MIC TEST ================= */

  const startMicTest = async () => {
    try {
      setIsMicTesting(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      setMicStream(stream);

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      source.connect(analyser);
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        setMicLevel(Math.min(100, (avg / 128) * 100));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch {
      setError("Microphone permission denied.");
      setIsMicTesting(false);
    }
  };

  /* ================= PRIMARY CAMERA ================= */

  const startPrimaryCameraTest = async () => {
    try {
      setPrimaryCameraError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      setPrimaryCameraStream(stream);
    } catch {
      setPrimaryCameraError("Camera permission denied.");
    }
  };

  useEffect(() => {
    if (currentStep === 4) startPrimaryCameraTest();
  }, [currentStep]);

  /* ================= MOBILE CAMERA SOCKET ================= */

  useEffect(() => {
    if (currentStep !== 5 || !sessionData) return;

    const socket = io(SOCKET_URL, {
      query: {
        interviewId: sessionData.interviewId,
        userId: sessionData.userId,
      },
    });

    settingsSocketRef.current = socket;

    socket.on("secondary_camera_ready", () => setMobileCameraConnected(true));

    socket.on("mobile_camera_frame", (data) => {
      if (!data?.frame || !mobileCanvasRef.current) return;

      const img = new Image();
      img.onload = () => {
        const ctx = mobileCanvasRef.current.getContext("2d");
        ctx.drawImage(img, 0, 0);
        setMobileFramesReceived((prev) => prev + 1);
      };
      img.src = data.frame;
    });

    QRCode.toDataURL(
      `${window.location.origin}/mobile-camera?mobile=true&interviewId=${sessionData.interviewId}&userId=${user.id}`,
    );

    return () => socket.disconnect();
  }, [currentStep, sessionData, user?.id]);

  /* ================= SCREEN SHARE ================= */

  const startScreenShareTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      setScreenShareStream(stream);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        await screenVideoRef.current.play().catch(() => {});
      }
    } catch {
      setScreenShareError("Screen share denied.");
    }
  };

  useEffect(() => {
    if (currentStep === 6) startScreenShareTest();
  }, [currentStep]);

  /* ================= START INTERVIEW ================= */

  const handleStartInterview = () => {
    if (!questionsReady) {
      setError("Finalizing questions...");
      return;
    }

    if (
      !micStream ||
      !primaryCameraStream ||
      !mobileCameraConnected ||
      !screenShareStream
    ) {
      setError("All devices must be configured.");
      return;
    }

    hasNavigatedRef.current = true;

    navigate("/interview/live", {
      state: {
        sessionData,
        micStream,
        primaryCameraStream,
        screenShareStream,
      },
    });
  };

  /* ================= CLEANUP ================= */

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      micStream?.getTracks().forEach((t) => t.stop());
      primaryCameraStream?.getTracks().forEach((t) => t.stop());
      screenShareStream?.getTracks().forEach((t) => t.stop());
      settingsSocketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (primaryVideoRef.current && primaryCameraStream) {
      primaryVideoRef.current.srcObject = primaryCameraStream;
    }
  }, [primaryCameraStream]);

  /* ================= STEP INDICATOR ================= */

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-4">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          <div
            className={`flex flex-col items-center ${
              currentStep >= step.num ? "opacity-100" : "opacity-40"
            }`}
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
                    {questionsReady ? "Start Interview" : "Finalizing..."}
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
