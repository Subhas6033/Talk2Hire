/**
 * tts.service.js — Deepgram TTS streaming
 *
 * FIX (Q2+ hang, no lag): speakStream calls are deduplicated by a per-call
 * promise. If a second speakStream fires while the first is still streaming,
 * it does NOT queue or block — instead it starts its own fetch immediately
 * (so the audio is ready with zero extra delay) but buffers the chunks
 * internally and only hands them to onChunk once the previous call has
 * emitted its null sentinel. This means:
 *   - No lag: Q2 fetch starts in parallel with Q1 playback
 *   - No collision: Q1's null sentinel never leaks into Q2's callback
 */

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const TTS_MODEL = "aura-asteria-en";
const TTS_SAMPLE_RATE = 48000;
const TTS_ENCODING = "linear16";
const TTS_CONTAINER = "none";
const TTS_API_URL = "https://api.deepgram.com/v1/speak";

function createTTSStream() {
  // Tracks when the currently-playing speak call has finished
  let currentDone = Promise.resolve();

  async function speakStream(text, onChunk) {
    if (!text?.trim()) {
      onChunk?.(null);
      return;
    }

    // Start fetching audio immediately — no waiting
    const fetchPromise = _fetchAudio(text);

    // Wait for the previous call to fully finish (emit its null) before
    // we start handing chunks to onChunk. The fetch itself is already
    // running in parallel so there is zero extra network delay.
    const previousDone = currentDone;
    let resolveDone;
    currentDone = new Promise((res) => {
      resolveDone = res;
    });

    try {
      await previousDone; // wait for Q1 to finish playing, not fetching
      const chunks = await fetchPromise; // already done or nearly done by now
      for (const chunk of chunks) {
        onChunk?.(chunk);
      }
    } catch (err) {
      console.error("❌ TTS speakStream error:", err.message);
    } finally {
      onChunk?.(null);
      resolveDone();
    }
  }

  async function _fetchAudio(text) {
    const url = new URL(TTS_API_URL);
    url.searchParams.set("model", TTS_MODEL);
    url.searchParams.set("encoding", TTS_ENCODING);
    url.searchParams.set("sample_rate", String(TTS_SAMPLE_RATE));
    url.searchParams.set("container", TTS_CONTAINER);

    const t0 = Date.now();
    const chunks = [];

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      let body = "";
      try {
        body = await res.text();
      } catch (_) {}
      console.error(`❌ Deepgram TTS HTTP ${res.status}:`, body.slice(0, 200));
      return chunks;
    }

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      let body = "";
      try {
        body = await res.text();
      } catch (_) {}
      console.error(
        "❌ Deepgram TTS returned JSON (not audio):",
        body.slice(0, 200),
      );
      return chunks;
    }

    const reader = res.body.getReader();
    while (true) {
      let done, value;
      try {
        ({ done, value } = await reader.read());
      } catch (e) {
        console.error("❌ TTS read error:", e);
        break;
      }
      if (done) break;
      if (!value?.length) continue;
      const chunk = Buffer.from(value);
      if (chunks.length === 0)
        console.log(
          `🔊 TTS first chunk: ${Date.now() - t0}ms  ${chunk.length}b`,
        );
      chunks.push(chunk);
    }

    console.log(
      `🔊 TTS fetched: ${chunks.length} chunks  ${Date.now() - t0}ms`,
    );
    return chunks;
  }

  return { speakStream };
}

module.exports = { createTTSStream };
