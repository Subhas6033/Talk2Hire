import { useEffect, useRef } from "react";

/**
 * ✅ FULLY FIXED TTS Hook
 * - Handles base64 audio (not ArrayBuffer)
 * - Zero-latency playback
 * - Proper cleanup
 */
export const useTTS = (ws) => {
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (!ws) return;

    // ✅ Pre-warm AudioContext on mount (saves 50-200ms on first play)
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
      latencyHint: "interactive", // Optimize for low latency
    });
    audioCtxRef.current = audioCtx;

    // Resume immediately if suspended
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    ws.onmessage = async (msg) => {
      try {
        // ✅ FIX: Server sends base64 strings, NOT ArrayBuffer
        if (typeof msg.data !== "string") {
          console.warn("Unexpected message type:", typeof msg.data);
          return;
        }

        const data = JSON.parse(msg.data);

        // Handle different message types
        if (data.type === "tts_audio" && data.audio) {
          await playAudioChunk(data.audio);
        } else if (data.type === "tts_end") {
          console.log("TTS stream complete");
        }
      } catch (err) {
        console.error("TTS playback error:", err);
      }
    };

    /**
     * ✅ OPTIMIZED: Play base64 audio immediately
     */
    const playAudioChunk = async (base64Audio) => {
      const audioCtx = audioCtxRef.current;

      // Resume context if suspended
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      // Stop previous source if playing
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }

      // ✅ Convert base64 to ArrayBuffer
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // ✅ Decode PCM16 audio
      const numSamples = bytes.length / 2;
      const audioBuffer = audioCtx.createBuffer(1, numSamples, 48000);
      const channelData = audioBuffer.getChannelData(0);
      const dataView = new DataView(bytes.buffer);

      for (let i = 0; i < numSamples; i++) {
        // Convert int16 to float32
        channelData[i] = dataView.getInt16(i * 2, true) / 32768;
      }

      // ✅ Create and play source immediately
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      source.onended = () => {
        isPlayingRef.current = false;
        sourceRef.current = null;
      };

      source.start(0);
      sourceRef.current = source;
      isPlayingRef.current = true;
    };

    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }
      if (audioCtxRef.current?.state !== "closed") {
        audioCtxRef.current?.close();
      }
    };
  }, [ws]);

  return {
    isPlaying: isPlayingRef.current,
    audioContext: audioCtxRef.current,
  };
};
