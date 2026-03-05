import { useRef, useState, useCallback, useEffect } from "react";
import axios from "axios";
import streamStore from "./streamSingleton";

const CHUNK_INTERVAL_MS = 20_000;
const API_BASE = import.meta.env.VITE_BACKEND_URL;

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function createRecorderSession(interviewId, videoType) {
  const uploadQueue = { current: Promise.resolve() };
  let chunkIndex = 0;
  let sessionStarted = false;
  let sessionReadyPromise = null;
  let stopped = false;
  let recorder = null;

  async function startSession() {
    if (sessionStarted) return true;
    if (sessionReadyPromise) return sessionReadyPromise;

    sessionReadyPromise = (async () => {
      try {
        await axios.post(
          `${API_BASE}/api/v1/video/start-recording`,
          { interviewId, videoType },
          { withCredentials: true },
        );
        sessionStarted = true;
        return true;
      } catch (err) {
        console.error(
          `❌ start-recording (${videoType}):`,
          err.response?.data || err.message,
        );
        sessionReadyPromise = null;
        return false;
      }
    })();

    return sessionReadyPromise;
  }

  async function uploadChunk(buffer, index) {
    const form = new FormData();
    form.append(
      "chunk",
      new Blob([buffer], { type: "video/webm" }),
      `chunk_${index}.webm`,
    );
    form.append("chunkIndex", String(index));
    form.append("videoType", videoType);
    try {
      await axios.post(`${API_BASE}/api/v1/video/${interviewId}/chunk`, form, {
        withCredentials: true,
      });
    } catch (err) {
      console.error(
        `❌ Chunk ${index} (${videoType}) failed:`,
        err.response?.data || err.message,
      );
    }
  }

  function enqueueChunk(buffer, index) {
    uploadQueue.current = uploadQueue.current.then(() =>
      uploadChunk(buffer, index),
    );
  }

  async function start(stream) {
    if (stopped) return false;

    const ok = await startSession();
    if (!ok) return false;

    const tracks = stream.getTracks().filter((t) => t.readyState === "live");
    if (tracks.length === 0) {
      console.warn(`⚠️ No live tracks for ${videoType}`);
      return false;
    }

    const combinedStream = new MediaStream(tracks);
    const mimeType = pickMimeType();
    const options = { videoBitsPerSecond: 800_000 };
    if (mimeType) options.mimeType = mimeType;

    try {
      recorder = new MediaRecorder(combinedStream, options);
    } catch (_) {
      recorder = new MediaRecorder(combinedStream);
    }

    recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      const idx = chunkIndex++;
      e.data.arrayBuffer().then((buf) => enqueueChunk(buf, idx));
    };

    recorder.start(CHUNK_INTERVAL_MS);
    console.log(`▶️  Server recording started (${videoType})`);
    return true;
  }

  async function stop() {
    stopped = true;
    if (!recorder || recorder.state === "inactive") return;

    await new Promise((resolve) => {
      const prev = recorder.onstop;
      recorder.onstop = () => {
        if (prev) prev();
        resolve();
      };
      try {
        recorder.stop();
      } catch (_) {
        resolve();
      }
    });

    await uploadQueue.current;
    console.log(`⏹  All chunks uploaded (${videoType})`);
  }

  function getState() {
    return recorder?.state ?? "inactive";
  }

  function wasStarted() {
    return sessionStarted;
  }

  return { start, stop, getState, wasStarted };
}

const useServerRecording = (
  interviewId,
  cameraStream,
  micStream,
  screenStream,
) => {
  const [isRecording, setIsRecording] = useState(false);

  const primaryRef = useRef(null);
  const secondaryRef = useRef(null);
  const screenRef = useRef(null);
  const stoppedRef = useRef(false);

  const start = useCallback(
    async (liveScreenStreamOverride = null) => {
      if (stoppedRef.current || !interviewId) return;

      const sessions = [];

      if (cameraStream?.active || micStream?.active) {
        const tracks = [];
        if (cameraStream) {
          const vt = cameraStream.getVideoTracks()[0];
          if (vt?.readyState === "live") tracks.push(vt);
        }
        if (micStream) {
          const at = micStream.getAudioTracks()[0];
          if (at?.readyState === "live") tracks.push(at);
        }
        if (tracks.length > 0) {
          primaryRef.current = createRecorderSession(
            interviewId,
            "primary_camera",
          );
          sessions.push(primaryRef.current.start(new MediaStream(tracks)));
        }
      }

      // ✅ Use override passed at call time, fall back to streamStore, then prop
      const liveScreenStream =
        liveScreenStreamOverride ??
        streamStore.screenShareStream ??
        screenStream ??
        null;

      if (liveScreenStream?.active) {
        const vt = liveScreenStream.getVideoTracks()[0];
        if (vt?.readyState === "live") {
          screenRef.current = createRecorderSession(
            interviewId,
            "screen_recording",
          );
          sessions.push(screenRef.current.start(new MediaStream([vt])));
        }
      }

      const results = await Promise.allSettled(sessions);
      const anyStarted = results.some(
        (r) => r.status === "fulfilled" && r.value === true,
      );
      if (anyStarted) setIsRecording(true);
    },
    [interviewId, cameraStream, micStream, screenStream],
  );

  const startSecondary = useCallback(
    async (secondaryCamStream) => {
      if (stoppedRef.current || !interviewId || !secondaryCamStream?.active)
        return;
      const vt = secondaryCamStream.getVideoTracks()[0];
      if (!vt || vt.readyState !== "live") return;
      secondaryRef.current = createRecorderSession(
        interviewId,
        "secondary_camera",
      );
      await secondaryRef.current.start(new MediaStream([vt]));
      console.log("▶️  Secondary camera server recording started");
    },
    [interviewId],
  );

  const stop = useCallback(async () => {
    stoppedRef.current = true;

    const jobs = [];
    if (primaryRef.current)
      jobs.push(primaryRef.current.stop().catch(console.error));
    if (secondaryRef.current)
      jobs.push(secondaryRef.current.stop().catch(console.error));
    if (screenRef.current)
      jobs.push(screenRef.current.stop().catch(console.error));

    await Promise.allSettled(jobs);

    const videoTypes = [];
    if (primaryRef.current?.wasStarted()) videoTypes.push("primary_camera");
    if (secondaryRef.current?.wasStarted()) videoTypes.push("secondary_camera");
    if (screenRef.current?.wasStarted()) videoTypes.push("screen_recording");

    await Promise.allSettled(
      videoTypes.map((videoType) =>
        axios
          .post(
            `${API_BASE}/api/v1/video/${interviewId}/end-recording`,
            { videoType },
            { withCredentials: true },
          )
          .catch((err) =>
            console.error(
              `❌ end-recording (${videoType}):`,
              err.response?.data || err.message,
            ),
          ),
      ),
    );

    setIsRecording(false);
    console.log("✅ All server recordings finalized");
  }, [interviewId]);

  useEffect(() => {
    return () => {
      [primaryRef, secondaryRef, screenRef].forEach((ref) => {
        if (ref.current?.getState() !== "inactive") {
          try {
            ref.current.stop();
          } catch (_) {}
        }
      });
    };
  }, []);

  return { isRecording, start, startSecondary, stop };
};

export default useServerRecording;
