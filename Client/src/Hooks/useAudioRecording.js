import { useRef, useCallback, useEffect } from "react";

const SAMPLE_RATE = 48000;
const CHUNK_DURATION_MS = 20000; // 20 seconds to match video
const BUFFER_SIZE = 4096;

/**
 * Audio recording hook that captures:
 * 1. TTS audio (AI speaking)
 * 2. Microphone audio (user speaking)
 * Mixed together with timestamp sync
 */
const useAudioRecording = (socketRef, interviewId, userId) => {
  // Audio context and nodes
  const audioContextRef = useRef(null);
  const destinationRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // Track what's currently playing/recording
  const ttsGainNodeRef = useRef(null);
  const micGainNodeRef = useRef(null);
  const micSourceRef = useRef(null);

  // Recording state
  const chunkNumberRef = useRef(0);
  const recordingStartTimeRef = useRef(null);
  const isRecordingRef = useRef(false);
  const hasStartedRef = useRef(false);
  const audioSessionIdRef = useRef(null);

  /**
   * Initialize audio context and destination node
   */
  const initializeAudioRecording = useCallback(async () => {
    if (audioContextRef.current) {
      console.log("⚠️ Audio context already initialized");
      return;
    }

    try {
      console.log("🎙️ Initializing audio recording system...");

      // Create audio context at 48kHz to match TTS/STT
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      // Resume if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Create destination for mixed audio
      const destination = audioContext.createMediaStreamDestination();
      destinationRef.current = destination;

      // Create gain nodes for volume control
      const ttsGain = audioContext.createGain();
      const micGain = audioContext.createGain();

      ttsGain.gain.value = 1.0; // TTS at full volume
      micGain.gain.value = 1.0; // Mic at full volume

      ttsGainNodeRef.current = ttsGain;
      micGainNodeRef.current = micGain;

      // Connect gain nodes to destination
      ttsGain.connect(destination);
      micGain.connect(destination);

      console.log("✅ Audio recording system initialized", {
        sampleRate: audioContext.sampleRate,
        state: audioContext.state,
      });
    } catch (error) {
      console.error("❌ Failed to initialize audio recording:", error);
      throw error;
    }
  }, []);

  /**
   * Connect TTS audio to the mix
   * Called whenever TTS plays audio
   */
  const connectTTSAudio = useCallback((audioBuffer) => {
    if (!audioContextRef.current || !ttsGainNodeRef.current) {
      console.warn("⚠️ Audio context not ready for TTS connection");
      return null;
    }

    try {
      const audioContext = audioContextRef.current;

      // Create buffer source from the audio buffer
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect to TTS gain node (which connects to destination)
      source.connect(ttsGainNodeRef.current);

      console.log("🔊 TTS audio connected to recording mix");

      return source;
    } catch (error) {
      console.error("❌ Failed to connect TTS audio:", error);
      return null;
    }
  }, []);

  /**
   * Connect microphone to the mix
   */
  const connectMicrophoneAudio = useCallback(async (micStream) => {
    if (!audioContextRef.current || !micGainNodeRef.current) {
      console.warn("⚠️ Audio context not ready for mic connection");
      return;
    }

    try {
      const audioContext = audioContextRef.current;

      // Disconnect previous mic source if exists
      if (micSourceRef.current) {
        micSourceRef.current.disconnect();
      }

      // Create source from microphone stream
      const micSource = audioContext.createMediaStreamSource(micStream);

      // Connect mic to gain node (which connects to destination)
      micSource.connect(micGainNodeRef.current);
      micSourceRef.current = micSource;

      console.log("🎤 Microphone audio connected to recording mix");
    } catch (error) {
      console.error("❌ Failed to connect microphone audio:", error);
    }
  }, []);

  /**
   * Start recording mixed audio
   */
  const startRecording = useCallback(async () => {
    if (!destinationRef.current) {
      console.error("❌ Cannot start recording - destination not initialized");
      return;
    }

    if (isRecordingRef.current) {
      console.warn("⚠️ Already recording");
      return;
    }

    try {
      console.log("🎙️ Starting audio recording...");

      const stream = destinationRef.current.stream;

      // Check if stream has audio tracks
      const audioTracks = stream.getAudioTracks();
      console.log("📊 Audio stream has tracks:", audioTracks.length);

      // Use Opus codec for better compression and quality
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      console.log("🎵 Using MIME type:", mimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128 kbps
      });

      mediaRecorderRef.current = mediaRecorder;
      chunkNumberRef.current = 0;
      recordingStartTimeRef.current = Date.now();

      // Request audio recording session from server
      if (socketRef?.current?.connected) {
        socketRef.current.emit("audio_recording_start", {
          audioType: "mixed_audio",
          interviewId,
          userId,
          metadata: {
            mimeType,
            audioBitsPerSecond: 128000,
            sampleRate: SAMPLE_RATE,
          },
        });

        // Wait for server confirmation
        const confirmationPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Server audio session timeout"));
          }, 5000);

          const handler = (response) => {
            clearTimeout(timeout);
            console.log("✅ Server confirmed audio session:", response);
            audioSessionIdRef.current = response.audioId;
            resolve(response);
          };

          socketRef.current.once("audio_recording_ready", handler);
        });

        try {
          await confirmationPromise;
        } catch (err) {
          console.warn(
            "⚠️ Server didn't confirm audio session, proceeding anyway",
          );
        }
      }

      mediaRecorder.ondataavailable = async (event) => {
        if (!event.data || event.data.size === 0) {
          console.warn("⚠️ Empty audio chunk");
          return;
        }

        chunkNumberRef.current++;
        const currentChunk = chunkNumberRef.current;

        if (currentChunk % 5 === 0) {
          console.log(
            `📦 Audio chunk #${currentChunk} ready (${event.data.size} bytes)`,
          );
        }

        // Convert to base64 for WebSocket transmission
        const reader = new FileReader();
        reader.onloadend = () => {
          if (socketRef?.current?.connected) {
            const base64Data = reader.result.split(",")[1];

            socketRef.current.emit("audio_chunk", {
              audioType: "mixed_audio",
              audioId: audioSessionIdRef.current,
              chunkNumber: currentChunk,
              chunkData: base64Data,
              timestamp: Date.now(),
              interviewId,
              userId,
            });
          }
        };
        reader.readAsDataURL(event.data);
      };

      mediaRecorder.onstart = () => {
        console.log("✅ Audio recording started");
        isRecordingRef.current = true;
        hasStartedRef.current = true;
      };

      mediaRecorder.onstop = () => {
        console.log("🛑 Audio recording stopped");
        isRecordingRef.current = false;

        if (socketRef?.current?.connected) {
          socketRef.current.emit("audio_recording_stop", {
            audioType: "mixed_audio",
            audioId: audioSessionIdRef.current,
            totalChunks: chunkNumberRef.current,
            interviewId,
            userId,
          });
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("❌ Audio recorder error:", event.error);
      };

      // Start recording with 20-second chunks (aligned with video)
      mediaRecorder.start(CHUNK_DURATION_MS);

      console.log(
        `✅ Audio MediaRecorder started (${CHUNK_DURATION_MS}ms chunks)`,
      );
    } catch (error) {
      console.error("❌ Failed to start audio recording:", error);
      throw error;
    }
  }, [socketRef, interviewId, userId]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) {
      console.warn("⚠️ No active audio recording to stop");
      return;
    }

    console.log("🛑 Stopping audio recording...");

    try {
      const recorder = mediaRecorderRef.current;

      if (recorder.state !== "inactive") {
        recorder.stop();
      }

      // Disconnect audio sources
      if (micSourceRef.current) {
        micSourceRef.current.disconnect();
        micSourceRef.current = null;
      }

      console.log("✅ Audio recording stopped successfully");
    } catch (error) {
      console.error("❌ Error stopping audio recording:", error);
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      console.log("🧹 Cleaning up audio recording");

      if (isRecordingRef.current) {
        stopRecording();
      }

      if (micSourceRef.current) {
        micSourceRef.current.disconnect();
      }

      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
    };
  }, [stopRecording]);

  return {
    initializeAudioRecording,
    connectTTSAudio,
    connectMicrophoneAudio,
    startRecording,
    stopRecording,
    isRecording: isRecordingRef.current,
    audioContext: audioContextRef.current,
  };
};

export default useAudioRecording;
