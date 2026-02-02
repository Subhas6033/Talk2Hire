import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useInterview } from "../../Hooks/useInterviewHook";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

const InterviewQuestions = ({
  interviewId,
  userId,
  cameraStream,
  onCancel,
  onFinish,
}) => {
  // Use the comprehensive interview hook
  const interview = useInterview(interviewId, userId, cameraStream);

  const videoRef = useRef(null);
  const isCleaningUpRef = useRef(false);

  // Log camera stream on mount
  useEffect(() => {
    console.log("📹 InterviewQuestions mounted with cameraStream:", {
      hasStream: !!cameraStream,
      streamActive: cameraStream?.active,
      tracks: cameraStream?.getTracks().length,
    });
  }, [cameraStream]);

  /* 🎥 SET CAMERA STREAM TO VIDEO */
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      console.log("📹 Setting camera stream to video element");
      videoRef.current.srcObject = cameraStream;

      videoRef.current.play().catch((err) => {
        console.error("❌ Error playing video:", err);
      });
    }
  }, [cameraStream]);

  /* 🔌 SOCKET.IO CONNECTION */
  useEffect(() => {
    console.log("🔌 Initializing socket connection...");
    const socket = io(SOCKET_URL, {
      query: { interviewId, userId },
      transports: ["websocket"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    interview.socketRef.current = socket;

    socket.onAny((eventName, ...args) => {
      if (eventName !== "user_audio_chunk") {
        console.log(
          `📡 Socket event: "${eventName}"`,
          args.length > 0 ? args : ""
        );
      }
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      interview.setStatus("live");
    });

    socket.on("server_ready", () => {
      console.log("✅ Server ready!");
      interview.setServerReady(true);

      if (!interview.hasStarted) {
        console.log("🚀 Auto-starting interview...");
        interview.autoStartInterview();
      }
    });

    socket.on("question", (data) => {
      console.log("📨 Received 'question' event:", data);
      interview.handleQuestion(data);
    });

    socket.on("next_question", (data) => {
      console.log("📨 Received 'next_question' event:", data);
      interview.handleNextQuestion(data);
    });

    socket.on("idle_prompt", (data) => {
      console.log("⏰ Received idle prompt:", data);
      interview.handleIdlePrompt(data);
    });

    socket.on("transcript_received", (data) => {
      console.log("📝 Transcript received from server:", data);
      interview.handleTranscriptReceived(data);
    });

    socket.on("final_answer", (data) => {
      console.log("✅ Final answer:", data);
      interview.handleFinalAnswer(data.text);
    });

    socket.on("listening_enabled", () => {
      console.log("✅ Server enabled listening");
      interview.enableListening();
    });

    socket.on("listening_disabled", () => {
      console.log("🛑 Server disabled listening");
      interview.disableListening();
    });

    socket.on("tts_audio", (chunk) => {
      if (!chunk) {
        console.log("⚠️ Received empty audio chunk");
        return;
      }
      console.log("🔊 Received audio chunk");
      interview.handleTtsAudio(chunk);
    });

    socket.on("interview_complete", (data) => {
      console.log("🎉 Interview completed:", data);
      interview.handleInterviewComplete(data);

      alert(
        `Interview completed! You answered ${data.totalQuestions} questions.`
      );

      // Call onFinish if provided
      if (onFinish) {
        onFinish();
      }
    });

    socket.on("tts_end", () => {
      console.log("🔔 TTS stream ended");
      interview.handleTtsEnd();
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connect error:", err.message);
      interview.setStatus("error");
      interview.setIsInitializing(false);
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
      interview.setStatus("disconnected");
      interview.setMicStreamingActive(false);
    });

    socket.on("error", (error) => {
      console.error("❌ Socket error:", error);

      if (
        error.message &&
        !error.message.includes("Speech recognition") &&
        !error.message.includes("recognition error")
      ) {
        alert(
          `Interview error: ${error.message}. Please refresh and try again.`
        );
      }

      interview.setStatus("error");
    });

    // Initialize interview session
    interview.initializeInterview({
      interviewId,
      userId,
      sessionId: interviewId,
    });

    return () => {
      console.log("🧹 Cleaning up socket and resources...");
      isCleaningUpRef.current = true;

      if (interview.micStreamRef.current) {
        interview.micStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }

      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }

      socket.disconnect();
      console.log("🔌 Cleanup complete");
    };
  }, [interviewId, userId, cameraStream, onFinish]);

  return (
    <section className="p-4 md:p-6">
      <div className="max-w-350 mx-auto h-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 h-full">
          {/* Main Interview Section */}
          <div className="lg:col-span-8 flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
              {/* Clean Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        interview.isPlaying
                          ? "bg-blue-600"
                          : interview.isListening
                            ? "bg-emerald-600"
                            : "bg-gray-700"
                      }`}
                    >
                      {interview.isPlaying ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" />
                        </svg>
                      ) : interview.isListening ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Interview Assistant
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {interview.isPlaying
                        ? "Speaking"
                        : interview.isListening
                          ? "Listening"
                          : "Standby"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      interview.isPlaying
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        interview.isPlaying
                          ? "bg-blue-600 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    Audio
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      interview.isListening
                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        interview.isListening
                          ? "bg-emerald-600 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    Mic
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col p-6 bg-white dark:bg-gray-900">
                {/* Connection States */}
                {interview.status === "connecting" && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-3 border-gray-200 dark:border-gray-700 border-t-blue-600 rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Connecting to server
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Please wait...
                    </p>
                  </div>
                )}

                {interview.status === "live" && interview.isInitializing && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-3 border-gray-200 dark:border-gray-700 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Starting interview
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Setting up your session...
                    </p>
                  </div>
                )}

                {interview.status === "live" &&
                  !interview.currentQuestion &&
                  !interview.isInitializing && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 border-3 border-gray-200 dark:border-gray-700 border-t-purple-600 rounded-full animate-spin mb-4" />
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Loading question
                      </p>
                    </div>
                  )}

                {/* Active Interview */}
                {interview.status === "live" && interview.currentQuestion && (
                  <div className="flex-1 flex flex-col justify-center space-y-6">
                    {/* Idle Prompt Display */}
                    {interview.idlePrompt && (
                      <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <svg
                            className="w-5 h-5 text-amber-600 dark:text-amber-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                            Waiting for Response
                          </span>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          {interview.idlePrompt}
                        </p>
                      </div>
                    )}

                    {/* Question */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            Q
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Question {interview.questionOrder}
                        </span>
                      </div>
                      <p className="text-lg md:text-xl text-gray-900 dark:text-gray-100 leading-relaxed">
                        {interview.currentQuestion}
                      </p>
                    </div>

                    {/* Listening Indicator */}
                    {interview.isListening && (
                      <div className="flex items-center gap-2 justify-center pt-4">
                        <div className="flex gap-1">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 bg-emerald-600 dark:bg-emerald-500 rounded-full animate-bounce"
                              style={{ animationDelay: `${i * 0.1}s` }}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          Listening to your response
                        </span>
                      </div>
                    )}

                    {/* Live Transcript */}
                    {interview.liveTranscript && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          {interview.liveTranscript}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error States */}
                {interview.status === "error" && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-red-600 dark:text-red-400"
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
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Connection error
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Please refresh and try again
                    </p>
                  </div>
                )}

                {interview.status === "disconnected" && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-amber-600 dark:text-amber-400"
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
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Disconnected
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Reconnecting...
                    </p>
                  </div>
                )}
              </div>

              {/* User Response Section */}
              {!interview.isInitializing && interview.userText && (
                <div className="border-t border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-900/50">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          A
                        </span>
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Your Answer
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-8">
                      {interview.userText}
                    </p>
                  </div>
                </div>
              )}

              {/* Footer */}
              {!interview.isInitializing && (
                <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 bg-white dark:bg-gray-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Interview active
                    </div>
                    <Button
                      variant="secondary"
                      onClick={onCancel}
                      className="text-xs px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      End Interview
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Camera Section */}
          {cameraStream && (
            <div className="lg:col-span-4 flex flex-col">
              <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Video Preview
                    </h3>
                  </div>
                </div>

                <div className="flex-1 p-6 bg-white dark:bg-gray-900 flex items-center">
                  <div className="relative w-full aspect-4/3 bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    <div className="absolute top-3 left-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-md">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs font-medium text-white">
                          REC
                        </span>
                        <span className="text-xs font-mono text-white/80">
                          {interview.recordingDuration}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-gray-400 shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Recording for analysis and evaluation
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default InterviewQuestions;
