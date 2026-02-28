import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "../Hooks/useInterviewHook";
import useVideoRecording from "../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../Hooks/useHolisticDetectionHook";
import useScreenRecording from "../Hooks/useScreenRecording";
import useServerRecording from "../Hooks/useServerRecording";
import { Button } from "../Components/index";
import { Card } from "../Components/Common/Card";
import { useStreams } from "../Hooks/streamContext";
import streamStore from "../Hooks/streamSingleton";

let _globalSocketInitialized = false;
let _globalClientReadyEmitted = false;

const InterviewLive = () => {
  const navigate = useNavigate();
  const streamsRef = useStreams();

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

  const serverRecording = useServerRecording(
    sessionData?.interviewId,
    primaryCameraStream,
    micStream,
    streamStore.screenShareStream ??
      streamsRef.current?.screenShareStream ??
      null,
  );
  const serverRecordingStoppedRef = useRef(false);

  const videoRef = useRef(null);
  const mobileVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const recordingsStartedRef = useRef(false);
  const isLeavingRef = useRef(false);
  const screenVideoActiveRef = useRef(false);
  const mobilePcRef = useRef(null);
  const pendingMobileStreamRef = useRef(null);

  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [faceViolationWarning, setFaceViolationWarning] = useState(null);
  const [isInterviewTerminated, setIsInterviewTerminated] = useState(false);
  const [mobileCameraConnected, setMobileCameraConnected] = useState(
    () => preWarmComplete?.secondaryCamera ?? false,
  );
  const [mobileTrackAttached, setMobileTrackAttached] = useState(false);
  const [screenVideoActive, setScreenVideoActive] = useState(false);
  const [socketReady, setSocketReady] = useState(false);

  useHolisticDetection(
    videoRef,
    interview.socketRef,
    interview.status === "live" && !interview.isInitializing,
  );

  useEffect(() => {
    return () => {
      _globalSocketInitialized = false;
      _globalClientReadyEmitted = false;
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!sessionData) {
      const t = setTimeout(() => {
        if (!stableRef.current?.sessionData)
          navigate("/interview", { replace: true });
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line

  const stopServerRecordingOnce = useCallback(async () => {
    if (serverRecordingStoppedRef.current || !sessionData?.interviewId) return;
    serverRecordingStoppedRef.current = true;
    try {
      await serverRecording.stop();
    } catch (err) {
      console.error("❌ stopServerRecordingOnce:", err.message);
    }
  }, [serverRecording, sessionData]);

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
    jobs.push(stopServerRecordingOnce());
    await Promise.allSettled(jobs);
  }, [
    isVideoRecording,
    audioRecording,
    screenRecording,
    stopServerRecordingOnce,
  ]); // eslint-disable-line

  useEffect(() => {
    if (!videoRef.current || !primaryCameraStream) return;
    videoRef.current.srcObject = primaryCameraStream;
    videoRef.current.muted = true;
    videoRef.current.play().catch((e) => {
      if (e.name !== "AbortError") console.error("[CAM] play error:", e);
    });
  }, []); // eslint-disable-line

  const setupMobilePeerConnection = useCallback(() => {
    if (mobilePcRef.current) {
      const state = mobilePcRef.current.connectionState;
      if (
        state === "failed" ||
        state === "closed" ||
        state === "disconnected"
      ) {
        try {
          mobilePcRef.current.close();
        } catch (_) {}
        mobilePcRef.current = null;
      } else {
        return mobilePcRef.current;
      }
    }

    const ICE_SERVERS = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    mobilePcRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && interview.socketRef.current?.connected) {
        interview.socketRef.current.emit(
          "mobile_webrtc_ice_candidate_desktop",
          { candidate },
        );
      }
    };

    pc.ontrack = (event) => {
      if (event.track.kind !== "video") return;
      const el = mobileVideoRef.current;
      if (el) {
        const remoteStream = new MediaStream([event.track]);
        el.srcObject = remoteStream;
        el.muted = true;
        el.play().catch(() => {});
        pendingMobileStreamRef.current = remoteStream;
      }
      setMobileTrackAttached(true);
      setMobileCameraConnected(true);
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        setMobileTrackAttached(false);
      }
    };

    return pc;
  }, [interview.socketRef]);

  const attachScreenVideo = useCallback(() => {
    const vid = screenVideoRef.current;
    if (!vid) return false;
    const stream =
      streamStore.screenShareStream ??
      streamsRef.current?.screenShareStream ??
      null;
    if (!stream?.active) return false;
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
      });
    };
    vid.addEventListener("loadedmetadata", tryPlay, { once: true });
    if (vid.readyState >= 1) tryPlay();
    const onEnded = () => {
      vid.srcObject = null;
      screenVideoActiveRef.current = false;
      setScreenVideoActive(false);
    };
    track.addEventListener("ended", onEnded);
    return () => track.removeEventListener("ended", onEnded);
  }, []); // eslint-disable-line

  useEffect(() => {
    const c = attachScreenVideo();
    if (c) return c;
    let retries = 0,
      active = null;
    const t = setInterval(() => {
      retries++;
      active = attachScreenVideo();
      if (active || retries >= 100) clearInterval(t);
    }, 100);
    return () => {
      clearInterval(t);
      if (active) active();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (_globalSocketInitialized || !sessionData || !preInitializedSocket)
      return;
    _globalSocketInitialized = true;

    const socket = preInitializedSocket;

    const init = async () => {
      try {
        let retries = 0;
        while (!socket.connected && retries < 50) {
          await new Promise((r) => setTimeout(r, 200));
          retries++;
        }
        if (!socket.connected) {
          _globalSocketInitialized = false;
          navigate("/interview");
          return;
        }

        interview.socketRef.current = socket;

        socket.on("mobile_webrtc_offer_relay", async ({ offer, identity }) => {
          const pc = setupMobilePeerConnection();
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("mobile_webrtc_answer", {
              answer: pc.localDescription,
              identity,
            });
            setMobileCameraConnected(true);
          } catch (err) {
            console.error("[MOBILE-PC] offer handling failed:", err.message);
          }
        });

        socket.on("mobile_webrtc_ice_from_mobile", async ({ candidate }) => {
          const pc = mobilePcRef.current;
          if (!pc || !candidate) return;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (_) {}
        });

        const silenced = new Set([
          "user_audio_chunk",
          "video_chunk",
          "audio_chunk",
          "holistic_detection_result",
          "interim_transcript",
        ]);
        socket.onAny((ev) => {
          if (!silenced.has(ev)) console.log(`[SOCKET] "${ev}"`);
        });

        socket.on("secondary_camera_ready", () =>
          setMobileCameraConnected(true),
        );
        socket.on("secondary_camera_status", (d) => {
          if (d?.connected) setMobileCameraConnected(true);
        });
        socket.on("question", (d) => interview.handleQuestion(d));
        socket.on("next_question", (d) => interview.handleNextQuestion(d));
        socket.on("tts_audio", (d) => {
          if (d) interview.handleTtsAudio(d);
        });
        socket.on("tts_end", () =>
          interview.handleTtsEnd(() => {
            const liveSocket = interview.socketRef.current;
            if (liveSocket?.connected) liveSocket.emit("playback_done");
          }),
        );
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
        socket.on("disconnect", (reason) => {
          _globalSocketInitialized = false;
          _globalClientReadyEmitted = false;
          if (reason === "io server disconnect" && !isLeavingRef.current) {
            alert("Server disconnected.");
            navigate("/interview");
          }
        });
        socket.on("connect_error", (e) =>
          console.error("[SOCKET] connect_error:", e.message),
        );
        socket.on("error", () => interview.setStatus("error"));

        interview.setStatus("live");
        interview.setServerReady(true);
        interview.setIsInitializing(false);
        interview.initializeInterview({
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
        });
        setSocketReady(true);

        socket.emit("request_secondary_camera_status", {
          interviewId: sessionData.interviewId,
        });
        interview.autoStartInterview(micStream).catch(console.error);

        if (!_globalClientReadyEmitted) {
          _globalClientReadyEmitted = true;
          socket.emit("client_ready", {
            interviewId: sessionData.interviewId,
            userId: sessionData.userId,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        console.error("[SOCKET] init() FAILED:", err.message);
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
        interview.cleanupWebRTC();
        if (mobilePcRef.current) {
          mobilePcRef.current.close();
          mobilePcRef.current = null;
        }
      }
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (
      recordingsStartedRef.current ||
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
        const activeScreen =
          streamStore.screenShareStream ??
          streamsRef.current?.screenShareStream;
        if (activeScreen?.active)
          await screenRecording.startRecording(activeScreen);

        await serverRecording.start();

        if (pendingMobileStreamRef.current) {
          serverRecording
            .startSecondary(pendingMobileStreamRef.current)
            .catch((e) =>
              console.error("❌ startSecondary (deferred):", e.message),
            );
          pendingMobileStreamRef.current = null;
        }
      } catch (err) {
        console.error("[REC] Startup failed:", err.message);
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

  useEffect(() => {
    if (!recordingsStartedRef.current) return;
    if (!pendingMobileStreamRef.current) return;
    serverRecording
      .startSecondary(pendingMobileStreamRef.current)
      .catch(console.error);
    pendingMobileStreamRef.current = null;
  }, [mobileTrackAttached]); // eslint-disable-line

  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults)
      setTimeout(() => navigate("/dashboard"), 2000);
  }, [evaluationStatus, evaluationResults, navigate]);

  const handleEndInterview = async () => {
    if (!confirm("Are you sure you want to end the interview?")) return;
    isLeavingRef.current = true;

    await cleanupAllRecordings();

    const socket = interview.socketRef.current;
    if (socket) {
      socket.offAny();
      socket.removeAllListeners();
      socket.disconnect();
    }

    interview.cleanupWebRTC();
    if (mobilePcRef.current) {
      mobilePcRef.current.close();
      mobilePcRef.current = null;
    }

    navigate("/dashboard");
  };

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-purple-200 border-t-purple-500 rounded-full mx-auto" />
          <p className="text-gray-400 text-sm">Loading interview session…</p>
        </div>
      </div>
    );
  }

  const Dot = ({ on, color = "gray" }) => {
    const c = {
      gray: "bg-gray-300",
      blue: "bg-blue-500",
      green: "bg-green-500",
      red: "bg-red-500",
      orange: "bg-orange-500",
      purple: "bg-purple-500",
      emerald: "bg-emerald-500",
    };
    return (
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
          on ? c[color] + " animate-pulse" : "bg-gray-300"
        }`}
      />
    );
  };

  const StatusBadge = ({ label, on, color = "gray" }) => {
    const bg = {
      gray: "bg-gray-100 text-gray-400 border border-gray-200",
      blue: "bg-blue-50 text-blue-600 border border-blue-200",
      green: "bg-green-50 text-green-600 border border-green-200",
      red: "bg-red-50 text-red-600 border border-red-200",
      orange: "bg-orange-50 text-orange-600 border border-orange-200",
      purple: "bg-purple-50 text-purple-600 border border-purple-200",
      emerald: "bg-emerald-50 text-emerald-600 border border-emerald-200",
    };
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
          on ? bg[color] : bg.gray
        }`}
      >
        <Dot on={on} color={color} /> {label}
      </div>
    );
  };

  return (
    <section className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* ── Main Panel ── */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col border border-gray-200 bg-white shadow-sm min-h-150">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      interview.isPlaying
                        ? "bg-blue-500"
                        : interview.isListening
                          ? "bg-emerald-500"
                          : "bg-gray-100"
                    }`}
                  >
                    <span
                      className={`text-sm font-bold ${
                        interview.isPlaying || interview.isListening
                          ? "text-white"
                          : "text-gray-500"
                      }`}
                    >
                      {interview.isPlaying ? "AI" : "🎤"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Talk2Hire</p>
                    <p className="text-xs text-gray-400">
                      {interview.isPlaying
                        ? "Speaking…"
                        : interview.isListening
                          ? "Listening…"
                          : interview.currentQuestion
                            ? "Ready"
                            : "Initialising…"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <StatusBadge
                    label="Audio"
                    on={audioRecording?.isRecording}
                    color="blue"
                  />
                  <StatusBadge
                    label="Mic"
                    on={interview.isListening}
                    color="emerald"
                  />
                  <StatusBadge
                    label="Camera"
                    on={isVideoRecording}
                    color="red"
                  />
                  <StatusBadge
                    label="Mobile"
                    on={mobileTrackAttached}
                    color="orange"
                  />
                  <StatusBadge
                    label="Screen"
                    on={screenRecording.isRecording}
                    color="purple"
                  />
                  <StatusBadge
                    label="Recording"
                    on={serverRecording.isRecording}
                    color="green"
                  />
                </div>
              </div>

              {/* Face Violation Warning */}
              {faceViolationWarning && (
                <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                  <p className="text-sm font-semibold text-red-600">
                    ⚠️{" "}
                    {faceViolationWarning.type === "NO_FACE"
                      ? `No face detected — ${faceViolationWarning.max - faceViolationWarning.count} warning(s) remaining`
                      : "Multiple faces detected"}
                  </p>
                </div>
              )}

              {/* Evaluation Banner */}
              {evaluationStatus === "started" && (
                <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-300 border-t-blue-500 rounded-full shrink-0" />
                  <p className="text-sm font-semibold text-blue-600">
                    Evaluating your responses…
                  </p>
                </div>
              )}

              {/* Question Body */}
              <div className="flex-1 p-6 flex flex-col justify-center space-y-5">
                {interview.currentQuestion ? (
                  <>
                    {interview.idlePrompt && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-sm text-amber-700">
                          {interview.idlePrompt}
                        </p>
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-purple-500 flex items-center justify-center text-xs font-bold text-white">
                          Q
                        </span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Question {interview.questionOrder ?? ""}
                        </span>
                      </div>
                      <p className="text-xl md:text-2xl text-gray-900 leading-relaxed font-medium">
                        {interview.currentQuestion}
                      </p>
                    </div>
                    {interview.isListening && (
                      <div className="flex items-center gap-2">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.12}s` }}
                          />
                        ))}
                        <span className="text-sm text-emerald-600 font-semibold">
                          Listening…
                        </span>
                      </div>
                    )}
                    {interview.liveTranscript && (
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-sm text-gray-500 italic">
                          {interview.liveTranscript}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-3 text-gray-400 text-sm">
                    <div className="animate-spin w-5 h-5 border-2 border-purple-200 border-t-purple-500 rounded-full" />
                    Waiting for first question…
                  </div>
                )}
              </div>

              {/* User Answer */}
              {interview.userText && (
                <div className="border-t border-gray-100 p-5 bg-gray-50">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">
                      A
                    </span>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {interview.userText}
                    </p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live • {interview.recordingDuration ?? "00:00"}
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

          {/* ── Camera Panels ── */}
          <div className="lg:col-span-1 space-y-3">
            {/* Primary Camera */}
            <Card className="overflow-hidden border border-gray-200 bg-white shadow-sm">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">
                  Primary Camera
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    isVideoRecording
                      ? "bg-red-50 text-red-500 border border-red-200"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isVideoRecording ? "● REC" : "STANDBY"}
                </span>
              </div>
              <div className="aspect-video bg-gray-900">
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

            {/* Mobile Camera */}
            <Card className="overflow-hidden border border-gray-200 bg-white shadow-sm">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">
                  Mobile Camera
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    mobileTrackAttached
                      ? "bg-orange-50 text-orange-500 border border-orange-200"
                      : mobileCameraConnected
                        ? "bg-green-50 text-green-600 border border-green-200"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {mobileTrackAttached
                    ? "● LIVE"
                    : mobileCameraConnected
                      ? "● JOINING"
                      : "WAITING"}
                </span>
              </div>
              <div className="relative aspect-video bg-gray-900">
                <video
                  id="secondary-camera-video"
                  ref={mobileVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  style={{
                    transform: "scaleX(-1)",
                    opacity: mobileTrackAttached ? 1 : 0,
                    transition: "opacity 0.3s ease",
                  }}
                />
                {!mobileCameraConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 gap-2">
                    <div className="animate-spin w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full" />
                    <p className="text-gray-400 text-xs">Waiting for mobile…</p>
                    <p className="text-gray-300 text-xs">
                      Scan the QR code on your phone
                    </p>
                  </div>
                )}
                {mobileCameraConnected && !mobileTrackAttached && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 gap-2">
                    <div className="animate-spin w-8 h-8 border-2 border-green-200 border-t-green-500 rounded-full" />
                    <p className="text-gray-500 text-xs">
                      Connecting video track…
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Screen Share */}
            <Card className="overflow-hidden border border-gray-200 bg-white shadow-sm">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">Screen</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    screenRecording.isRecording
                      ? "bg-purple-50 text-purple-500 border border-purple-200"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {screenRecording.isRecording ? "● REC" : "STANDBY"}
                </span>
              </div>
              <div className="relative aspect-video bg-gray-900">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                {!screenVideoActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl opacity-20">🖥️</span>
                    <p className="text-gray-400 text-xs">
                      {screenShareStreamRef.current
                        ? "Connecting…"
                        : "No screen share"}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Interview Terminated Overlay */}
      {isInterviewTerminated && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-2xl">✕</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Interview Terminated
            </h3>
            <p className="text-gray-400 text-sm">
              Your session was ended due to a proctoring violation.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default InterviewLive;
