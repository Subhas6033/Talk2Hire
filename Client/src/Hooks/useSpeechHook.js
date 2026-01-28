import { useEffect, useRef } from "react";

export const useTTS = (ws) => {
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!ws) return;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = audioCtx;

    ws.onmessage = async (msg) => {
      try {
        // Ignore JSON text messages
        if (typeof msg.data === "string") return;

        // Handle audio ArrayBuffer
        const arrayBuffer = await msg.data.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();

        sourceRef.current = source;
      } catch (err) {
        console.error("TTS playback error:", err);
      }
    };

    return () => {
      sourceRef.current?.stop();
      audioCtxRef.current?.close();
    };
  }, [ws]);
};
