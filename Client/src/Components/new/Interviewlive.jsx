import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "../../Hooks/useInterviewHook";
import useVideoRecording from "../../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../../Hooks/useHolisticDetectionHook";
import useScreenRecording from "../../Hooks/useScreenRecording";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useStreams } from "../../Hooks/streamContext";
import streamStore from "../../Hooks/streamSingleton";

let _globalSocketInitialized = false;
let _globalClientReadyEmitted = false;

const InterviewLive = () => {
  const navigate = useNavigate();
  const streamsRef = useStreams();

  // ── Pull session data from singleton / context ─────────────────────────────
  const stableRef = useRef(null);
  if (!stableRef.current) {
    const src = streamStore.sessionData ? streamStore : streamsRef.current;
    if (src?.sessionData) {
      stableRef.current = {
        sessionData: src.sessionData,
        micStream: src.micStream,
        primaryCameraStream: src.primaryCameraStream,
        preInitializedSocket: src.preInitializedSocket,
        preWarmSessionIds: { ...(src.preWarmSessionIds ?? {}) },
        preWarmComplete: { ...(src.preWarmComplete ?? {}) },
      };
    }
  }

  const sessionData = stableRef.current?.sessionData ?? null;
  const micStream = stableRef.current?.micStream ?? null;
  const primaryCameraStream = stableRef.current?.primaryCameraStream ?? null;
  const preInitializedSocket = stableRef.current?.preInitializedSocket ?? null;
  const preWarmSessionIds = stableRef.current?.preWarmSessionIds ?? {};
  const preWarmComplete = stableRef.current?.preWarmComplete ?? {};

  const screenShareStreamRef = useRef(null);

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const interview = useInterview(
    sessionData?.interviewId,
    sessionData?.userId,
    primaryCameraStream,
  );

  const {
    isRecording: isVideoRecording,
    startRecording: startVideoRecording,
    stopRecording: stopVideoRecording,
  } = useVideoRecording(
    sessionData?.interviewId,
    sessionData?.userId,
    primaryCameraStream,
    interview.socketRef,
    preWarmSessionIds.primaryCameraId,
  );

  const audioRecording = interview.audioRecording;

  const screenRecording = useScreenRecording(
    sessionData?.interviewId,
    sessionData?.userId,
    interview.socketRef,
    preWarmSessionIds.screenRecordingId,
  );

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef = useRef(null); // primary camera
  const mobileCanvasRef = useRef(null); // secondary camera — WebSocket frames drawn here
  const screenVideoRef = useRef(null); // screen share

  const recordingsStartedRef = useRef(false);
  const isLeavingRef = useRef(false);

  // Mobile secondary camera state (WebSocket frames — no WebRTC)
  const mobileMediaRecorderRef = useRef(null);
  const mobileChunkCountRef = useRef(0);
  const mobileSessionReadyRef = useRef(false);
  // Canvas stream for recording the mobile frames
  const mobileCanvasStreamRef = useRef(null);

  const screenVideoActiveRef = useRef(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const [isSecondaryRecording, setIsSecondaryRecording] = useState(false);
  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [faceViolationWarning, setFaceViolationWarning] = useState(null);
  const [isInterviewTerminated, setIsInterviewTerminated] = useState(false);
  const [mobileCameraConnected, setMobileCameraConnected] = useState(
    () => preWarmComplete?.secondaryCamera ?? false,
  );
  const [mobileFrameCount, setMobileFrameCount] = useState(0);
  const mobileFrameCountRef = useRef(0);

  const [screenVideoActive, setScreenVideoActive] = useState(false);
  const [socketReady, setSocketReady] = useState(false);

  useHolisticDetection(
    videoRef,
    interview.socketRef,
    interview.status === "live" && !interview.isInitializing,
  );

  // ── Cleanup global flags on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      _globalSocketInitialized = false;
      _globalClientReadyEmitted = false;
    };
  }, []);

  // ── Redirect if no session ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionData) {
      const t = setTimeout(() => {
        if (!stableRef.current?.sessionData)
          navigate("/interview", { replace: true });
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line

  // ── Stop all recordings ────────────────────────────────────────────────────
  const cleanupAllRecordings = useCallback(async () => {
    const jobs = [];
    if (isVideoRecording) jobs.push(stopVideoRecording().catch(console.error));
    if (audioRecording?.isRecording) {
      try {
        audioRecording.stopRecording();
      } catch (_) {}
    }
    if (screenRecording.isRecording)
      jobs.push(screenRecording.stopRecording().catch(console.error));
    const mobileRec = mobileMediaRecorderRef.current;
    if (mobileRec && mobileRec.state !== "inactive") {
      jobs.push(
        new Promise((resolve) => {
          mobileRec.onstop = () => resolve();
          try {
            mobileRec.stop();
          } catch (_) {
            resolve();
          }
        }).catch(console.error),
      );
    }
    await Promise.allSettled(jobs);
  }, [isVideoRecording, audioRecording, screenRecording]); // eslint-disable-line

  // ── Primary camera preview ─────────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !primaryCameraStream) return;
    videoRef.current.srcObject = primaryCameraStream;
    videoRef.current.muted = true;
    videoRef.current.play().catch((e) => {
      if (e.name !== "AbortError") console.error("Primary video play:", e);
    });
  }, []); // eslint-disable-line

  // ── Draw incoming WebSocket frame onto mobile canvas ───────────────────────
  // This is the core of the WebSocket streaming approach.
  // The server relays mobile_camera_frame events from the mobile device.
  // We draw each JPEG dataURL onto the canvas element for display.
  const drawMobileFrame = useCallback((frameDataUrl) => {
    const canvas = mobileCanvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        mobileFrameCountRef.current++;
        if (mobileFrameCountRef.current % 10 === 0) {
          setMobileFrameCount(mobileFrameCountRef.current);
        }
      }
    };
    img.src = frameDataUrl;
  }, []);

  // ── Start recording the mobile canvas stream ───────────────────────────────
  // We capture the canvas as a MediaStream and record it with MediaRecorder.
  // This gives us a proper video file of the secondary camera for FTP upload.
  const startMobileCanvasRecording = useCallback(
    async (socket) => {
      if (mobileMediaRecorderRef.current) return; // already recording

      const canvas = mobileCanvasRef.current;
      if (!canvas) {
        console.warn("⚠️ Mobile canvas not ready for recording");
        return;
      }

      try {
        // Capture canvas as a 10fps MediaStream (matches ~frame rate from mobile)
        const canvasStream = canvas.captureStream(10);
        mobileCanvasStreamRef.current = canvasStream;

        const mimeTypes = [
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
          "",
        ];
        let mediaRecorder;
        for (const mimeType of mimeTypes) {
          try {
            mediaRecorder = new MediaRecorder(
              canvasStream,
              mimeType ? { mimeType, videoBitsPerSecond: 1000000 } : {},
            );
            break;
          } catch (_) {
            continue;
          }
        }
        if (!mediaRecorder) {
          console.error("❌ No MediaRecorder for canvas stream");
          return;
        }

        mobileMediaRecorderRef.current = mediaRecorder;
        mobileChunkCountRef.current = 0;

        mediaRecorder.ondataavailable = (e) => {
          if (!e.data || e.data.size === 0) return;
          mobileChunkCountRef.current++;
          const chunkNum = mobileChunkCountRef.current;
          const reader = new FileReader();
          reader.onloadend = () => {
            if (socket?.connected && mobileSessionReadyRef.current) {
              socket.emit("video_chunk", {
                videoType: "secondary_camera",
                chunkNumber: chunkNum,
                chunkData: reader.result.split(",")[1],
                isLastChunk: false,
                timestamp: Date.now(),
              });
            }
          };
          reader.readAsDataURL(e.data);
        };

        mediaRecorder.onstart = () => {
          console.log("✅ Mobile canvas recording started");
          setIsSecondaryRecording(true);
        };

        mediaRecorder.onstop = () => {
          console.log(
            `🛑 Mobile canvas recording stopped. Chunks: ${mobileChunkCountRef.current}`,
          );
          setIsSecondaryRecording(false);
          mobileSessionReadyRef.current = false;
          mobileMediaRecorderRef.current = null;
          if (socket?.connected) {
            socket.emit("video_recording_stop", {
              videoType: "secondary_camera",
              totalChunks: mobileChunkCountRef.current,
            });
          }
        };

        // Register session or reuse pre-warmed one
        if (
          preWarmComplete.secondaryCamera &&
          preWarmSessionIds.secondaryCameraId
        ) {
          mobileSessionReadyRef.current = true;
        } else if (socket?.connected) {
          socket.emit("video_recording_start", {
            videoType: "secondary_camera",
            totalChunks: 0,
            metadata: { mimeType: "video/webm;codecs=vp9" },
          });
          await new Promise((resolve) => {
            const timeout = setTimeout(() => {
              mobileSessionReadyRef.current = true;
              resolve();
            }, 5000);
            const handler = (data) => {
              if (data.videoType === "secondary_camera") {
                clearTimeout(timeout);
                socket.off("video_recording_ready", handler);
                mobileSessionReadyRef.current = true;
                resolve();
              }
            };
            socket.on("video_recording_ready", handler);
          });
        } else {
          mobileSessionReadyRef.current = true;
        }

        mediaRecorder.start(20000); // 20-second chunks
        console.log("✅ Secondary camera canvas recording started");
      } catch (err) {
        console.error("❌ Failed to start mobile canvas recording:", err);
      }
    },
    [preWarmComplete, preWarmSessionIds],
  );

  // ── Screen share attachment ────────────────────────────────────────────────
  const attachScreenVideo = useCallback(() => {
    const vid = screenVideoRef.current;
    if (!vid) return false;
    const stream =
      streamStore.screenShareStream ??
      streamsRef.current?.screenShareStream ??
      null;
    if (!stream || !stream.active) return false;
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== "live") return false;

    screenShareStreamRef.current = stream;
    if (vid.srcObject !== stream) {
      vid.srcObject = stream;
      vid.muted = true;
    }

    screenVideoActiveRef.current = true;
    setScreenVideoActive(true);

    const tryPlay = () => {
      if (!vid.isConnected) return;
      vid.play().catch((e) => {
        if (e.name === "AbortError") setTimeout(tryPlay, 50);
        else if (e.name !== "NotAllowedError") console.error("Screen play:", e);
      });
    };
    vid.addEventListener("loadedmetadata", tryPlay, { once: true });
    vid.addEventListener("canplay", tryPlay, { once: true });
    if (vid.readyState >= 1) tryPlay();

    const onEnded = () => {
      vid.srcObject = null;
      screenVideoActiveRef.current = false;
      setScreenVideoActive(false);
      screenShareStreamRef.current = null;
    };
    track.addEventListener("ended", onEnded);
    return () => {
      vid.removeEventListener("loadedmetadata", tryPlay);
      vid.removeEventListener("canplay", tryPlay);
      track.removeEventListener("ended", onEnded);
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const cleanup = attachScreenVideo();
    if (cleanup) return cleanup;

    let retries = 0;
    let activeCleanup = null;
    const timer = setInterval(() => {
      retries++;
      const c = attachScreenVideo();
      if (c) {
        activeCleanup = c;
        clearInterval(timer);
      } else if (retries >= 100) {
        clearInterval(timer);
      }
    }, 100);
    return () => {
      clearInterval(timer);
      if (activeCleanup) activeCleanup();
    };
  }, []); // eslint-disable-line

  // ── Start mobile recording when first frame arrives ────────────────────────
  useEffect(() => {
    if (
      mobileCameraConnected &&
      !mobileMediaRecorderRef.current &&
      interview.status === "live" &&
      socketReady
    ) {
      startMobileCanvasRecording(interview.socketRef.current).catch(
        console.error,
      );
    }
  }, [
    mobileCameraConnected,
    interview.status,
    socketReady,
    startMobileCanvasRecording,
  ]);

  // ── Main socket init ───────────────────────────────────────────────────────
  useEffect(() => {
    if (_globalSocketInitialized || !sessionData || !preInitializedSocket)
      return;
    _globalSocketInitialized = true;

    const socket = preInitializedSocket;

    const init = async () => {
      try {
        let retries = 0;
        while (!socket.connected && retries < 30) {
          await new Promise((r) => setTimeout(r, 200));
          retries++;
        }
        if (!socket.connected) {
          console.error("❌ Socket never connected");
          _globalSocketInitialized = false;
          navigate("/interview");
          return;
        }

        interview.socketRef.current = socket;
        setSocketReady(true);

        // ── Secondary camera (WebSocket frames) ──────────────────────────────
        socket.on("secondary_camera_ready", () => {
          console.log("📱 Secondary camera connected via WebSocket");
          setMobileCameraConnected(true);
        });

        socket.on("secondary_camera_status", (d) => {
          if (d.connected) setMobileCameraConnected(true);
        });

        // This is the key event — server relays JPEG frames from mobile
        socket.on("mobile_camera_frame", (data) => {
          if (!data?.frame) return;
          // Mark connected on first frame (belt-and-suspenders)
          setMobileCameraConnected(true);
          drawMobileFrame(data.frame);
        });

        // ── Interview events ─────────────────────────────────────────────────
        const silenced = new Set([
          "user_audio_chunk",
          "video_chunk",
          "audio_chunk",
          "holistic_detection_result",
          "interim_transcript",
        ]);
        socket.onAny((ev) => {
          if (!silenced.has(ev)) console.log(`📡 [socket] "${ev}"`);
        });

        socket.on("question", (d) => interview.handleQuestion(d));
        socket.on("next_question", (d) => interview.handleNextQuestion(d));
        socket.on("tts_audio", (d) => {
          if (d) interview.handleTtsAudio(d);
        });
        socket.on("tts_end", () => interview.handleTtsEnd());
        socket.on("idle_prompt", (d) => interview.handleIdlePrompt(d));
        socket.on("interim_transcript", (d) => interview.setLiveTranscript(d));
        socket.on("transcript_received", (d) =>
          interview.handleTranscriptReceived(d),
        );
        socket.on("listening_enabled", () => interview.enableListening());
        socket.on("listening_disabled", () => interview.disableListening());
        socket.on("interview_complete", async (d) => {
          interview.handleInterviewComplete(d);
          await cleanupAllRecordings();
        });
        socket.on("face_violation", (d) => setFaceViolationWarning(d));
        socket.on("face_violation_cleared", () =>
          setFaceViolationWarning(null),
        );
        socket.on("interview_terminated", async () => {
          setIsInterviewTerminated(true);
          interview.setMicStreamingActive(false);
          await cleanupAllRecordings();
          isLeavingRef.current = true;
          socket.disconnect();
          navigate("/dashboard");
        });
        socket.on("evaluation_started", () => setEvaluationStatus("started"));
        socket.on("evaluation_complete", (d) => {
          setEvaluationStatus("complete");
          setEvaluationResults(d.results);
          interview.setMicStreamingActive(false);
        });
        socket.on("evaluation_error", () => setEvaluationStatus("error"));
        socket.on("media_merge_complete", (d) =>
          console.log("✅ Media merge:", d.finalVideoUrl),
        );
        socket.on("audio_recording_error", (d) =>
          console.error("❌ Audio error:", d),
        );
        socket.on("video_recording_error", (d) =>
          console.error("❌ Video error:", d),
        );
        socket.on("disconnect", (reason) => {
          if (reason === "io server disconnect" && !isLeavingRef.current) {
            alert("Server disconnected unexpectedly.");
            navigate("/interview");
          }
        });
        socket.on("connect_error", (e) =>
          console.error("❌ Connect error:", e.message),
        );
        socket.on("error", () => interview.setStatus("error"));

        interview.setStatus("live");
        interview.setServerReady(true);
        interview.setIsInitializing(false);
        interview.initializeInterview({
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
        });
        socket.emit("request_secondary_camera_status", {
          interviewId: sessionData.interviewId,
        });

        if (!_globalClientReadyEmitted) {
          _globalClientReadyEmitted = true;
          socket.emit("client_ready", {
            interviewId: sessionData.interviewId,
            userId: sessionData.userId,
            timestamp: Date.now(),
          });
        }

        await interview.autoStartInterview(micStream);
      } catch (err) {
        console.error("❌ Socket init failed:", err);
        _globalSocketInitialized = false;
        navigate("/interview");
      }
    };

    init();

    return () => {
      if (isLeavingRef.current) {
        cleanupAllRecordings();
        socket?.offAny();
        socket?.removeAllListeners();
        socket?.disconnect();
      }
    };
  }, []); // eslint-disable-line

  // ── Start primary recordings when interview goes live ─────────────────────
  useEffect(() => {
    if (recordingsStartedRef.current) return;
    if (
      !socketReady ||
      interview.status !== "live" ||
      interview.isInitializing ||
      !interview.serverReady ||
      !interview.hasStarted ||
      !primaryCameraStream ||
      isVideoRecording
    )
      return;

    recordingsStartedRef.current = true;
    (async () => {
      try {
        await audioRecording.startRecording(preWarmSessionIds.audioId);
        await startVideoRecording();
        const activeScreenStream =
          streamStore.screenShareStream ??
          streamsRef.current?.screenShareStream;
        if (activeScreenStream && activeScreenStream.active) {
          await screenRecording.startRecording(activeScreenStream);
          console.log("✓ Screen recording started");
        }
      } catch (err) {
        console.error("❌ Recording startup failed:", err);
        recordingsStartedRef.current = false;
      }
    })();
  }, [
    socketReady,
    interview.status,
    interview.isInitializing,
    interview.serverReady,
    interview.hasStarted,
    isVideoRecording,
  ]); // eslint-disable-line

  // ── Navigate to dashboard after evaluation ────────────────────────────────
  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults) {
      setTimeout(() => navigate("/dashboard"), 2000);
    }
  }, [evaluationStatus, evaluationResults, navigate]);

  const handleEndInterview = async () => {
    if (!confirm("End the interview?")) return;
    isLeavingRef.current = true;
    await cleanupAllRecordings();
    const socket = interview.socketRef.current;
    if (socket) {
      socket.offAny();
      socket.removeAllListeners();
      socket.disconnect();
    }
    navigate("/dashboard");
  };

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto mb-4" />
          <p className="text-white text-sm">Loading interview session…</p>
        </div>
      </div>
    );
  }

  const StatusBadge = ({ label, active, color = "gray" }) => (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${active ? `bg-${color}-900/30 text-${color}-300` : "bg-gray-800 text-gray-500"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? `bg-${color}-400 animate-pulse` : "bg-gray-600"}`}
      />
      {label}
    </div>
  );

  return (
    <section className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* ── Main interview panel ─────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col overflow-hidden shadow-xl border border-gray-700 bg-gray-800 min-h-150">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${interview.isPlaying ? "bg-blue-600" : interview.isListening ? "bg-emerald-600" : "bg-gray-700"}`}
                  >
                    <span className="text-white text-sm font-bold">
                      {interview.isPlaying ? "AI" : "🎤"}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      AI Interview
                    </h2>
                    <p className="text-xs text-gray-400">
                      {interview.isPlaying
                        ? "Speaking…"
                        : interview.isListening
                          ? "Listening…"
                          : "Ready"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <StatusBadge
                    label="Audio"
                    active={audioRecording?.isRecording}
                    color="blue"
                  />
                  <StatusBadge
                    label="Mic"
                    active={interview.isListening}
                    color="emerald"
                  />
                  <StatusBadge
                    label="Camera"
                    active={isVideoRecording}
                    color="red"
                  />
                  <StatusBadge
                    label="Mobile"
                    active={isSecondaryRecording}
                    color="orange"
                  />
                  <StatusBadge
                    label="Screen"
                    active={screenRecording.isRecording}
                    color="purple"
                  />
                </div>
              </div>

              {faceViolationWarning && (
                <div className="px-5 py-3 bg-red-900/20 border-b border-red-800">
                  <p className="text-sm font-semibold text-red-300">
                    ⚠️{" "}
                    {faceViolationWarning.type === "NO_FACE"
                      ? `No face detected — ${faceViolationWarning.max - faceViolationWarning.count} warning(s) remaining`
                      : "Multiple faces detected"}
                  </p>
                </div>
              )}

              {evaluationStatus === "started" && (
                <div className="px-5 py-3 bg-blue-900/20 border-b border-blue-800 flex items-center gap-3">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                  <p className="text-sm font-semibold text-blue-300">
                    Evaluating your responses…
                  </p>
                </div>
              )}

              <div className="flex-1 p-6 flex flex-col justify-center space-y-6">
                {interview.currentQuestion ? (
                  <>
                    {interview.idlePrompt && (
                      <div className="p-3 bg-amber-900/20 border border-amber-800 rounded-xl">
                        <p className="text-sm text-amber-200">
                          {interview.idlePrompt}
                        </p>
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                          Q
                        </span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Question {interview.questionOrder}
                        </span>
                      </div>
                      <p className="text-xl md:text-2xl text-white leading-relaxed font-medium">
                        {interview.currentQuestion}
                      </p>
                    </div>
                    {interview.isListening && (
                      <div className="flex items-center gap-2">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                            style={{ animationDelay: `${i * 0.1}s` }}
                          />
                        ))}
                        <span className="text-sm text-emerald-400 font-semibold">
                          Listening…
                        </span>
                      </div>
                    )}
                    {interview.liveTranscript && (
                      <div className="p-3 bg-gray-700/60 rounded-xl border border-gray-600">
                        <p className="text-sm text-gray-300 italic">
                          {interview.liveTranscript}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-gray-500 text-sm">
                    Waiting for first question…
                  </div>
                )}
              </div>

              {interview.userText && (
                <div className="border-t border-gray-700 p-5 bg-gray-800/80">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-xs font-bold text-white mt-0.5">
                      A
                    </span>
                    <p className="text-sm text-gray-300 flex-1">
                      {interview.userText}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-700 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live • {interview.recordingDuration}
                </div>
                <Button
                  variant="secondary"
                  onClick={handleEndInterview}
                  className="text-xs px-4 py-1.5"
                >
                  End Interview
                </Button>
              </div>
            </Card>
          </div>

          {/* ── Right column: cameras ────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-3">
            {/* Primary camera */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Primary Camera
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${isVideoRecording ? "text-red-300 bg-red-900/30" : "text-gray-500 bg-gray-700"}`}
                >
                  {isVideoRecording ? "● REC" : "STANDBY"}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
              </div>
            </Card>

            {/* Mobile camera — WebSocket canvas */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Mobile Camera
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    mobileCameraConnected
                      ? isSecondaryRecording
                        ? "text-orange-300 bg-orange-900/30"
                        : "text-green-300 bg-green-900/30"
                      : "text-gray-500 bg-gray-700"
                  }`}
                >
                  {mobileCameraConnected
                    ? isSecondaryRecording
                      ? "● REC"
                      : "● LIVE"
                    : "WAITING"}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                {/* Canvas always rendered — frames drawn onto it via drawMobileFrame() */}
                <canvas
                  ref={mobileCanvasRef}
                  width={640}
                  height={480}
                  className="w-full h-full object-cover"
                />

                {/* Overlay — only shown while waiting for first frame */}
                {!mobileCameraConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                    <div className="animate-spin w-8 h-8 border-2 border-orange-500/40 border-t-orange-500 rounded-full mb-2" />
                    <p className="text-white text-xs opacity-70">
                      Waiting for mobile…
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Scan QR code on your phone
                    </p>
                  </div>
                )}

                {/* Frame counter badge */}
                {mobileCameraConnected && (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/50 rounded text-xs text-gray-400 font-mono">
                    {mobileFrameCount} frames
                  </div>
                )}
              </div>
            </Card>

            {/* Screen share */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Screen</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${screenRecording.isRecording ? "text-purple-300 bg-purple-900/30" : "text-gray-500 bg-gray-700"}`}
                >
                  {screenRecording.isRecording ? "● REC" : "STANDBY"}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                {!screenVideoActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                    <span className="text-gray-600 text-2xl mb-2">🖥️</span>
                    <p className="text-gray-600 text-xs">
                      {screenShareStreamRef.current
                        ? "Connecting screen…"
                        : "Screen share not available"}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Termination modal */}
        {isInterviewTerminated && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-2xl p-8 text-center max-w-sm mx-4 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">✕</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Interview Terminated
              </h3>
              <p className="text-gray-400 text-sm">
                Your session has been ended due to a violation.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default InterviewLive;
