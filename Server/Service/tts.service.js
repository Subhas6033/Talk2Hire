const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const TTS_MODEL = "aura-asteria-en";
const TTS_SAMPLE_RATE = 48000;
const TTS_ENCODING = "linear16";
const TTS_CONTAINER = "none";
const TTS_API_URL = "https://api.deepgram.com/v1/speak";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const CHUNK_TIMEOUT = 30000;

// FIX: Minimum PCM chunk size before flushing to client.
// Deepgram streams raw PCM16 in small TCP segments (~1-4 KB).
// Emitting each segment individually causes the client to decode dozens of
// tiny AudioBuffers, each with its own decode overhead and gap between them.
// Accumulating to ~8 KB (≈85ms of audio at 48 kHz mono 16-bit) gives the
// client meaningfully-sized chunks without adding perceptible delay.
const MIN_CHUNK_BYTES = 8 * 1024; // 8 KB

function createTTSStream() {
  let currentDone = Promise.resolve();
  let abortController = null;

  async function speakStream(text, onChunk) {
    if (!text?.trim()) {
      onChunk?.(null);
      return;
    }

    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    const fetchPromise = _fetchAudioStreaming(
      text,
      abortController.signal,
      onChunk,
    );
    const previousDone = currentDone;

    let resolveDone;
    currentDone = new Promise((res) => {
      resolveDone = res;
    });

    try {
      await previousDone;
      await fetchPromise;
    } catch (err) {
      if (err.name === "AbortError") {
        console.log("🛑 TTS aborted");
      } else {
        console.error("❌ TTS speakStream error:", err.message);
      }
    } finally {
      onChunk?.(null);
      resolveDone();
      abortController = null;
    }
  }

  // FIX: Stream chunks to the client AS they arrive from Deepgram, instead of
  // buffering everything first and sending in a batch.
  //
  // Old flow:  Deepgram → buffer all → done → emit all chunks → client plays
  //            Latency = full TTS synthesis time (500ms–2s) before first audio
  //
  // New flow:  Deepgram → accumulate MIN_CHUNK_BYTES → emit → client plays
  //            Latency ≈ time-to-first-byte from Deepgram (~150ms) + buffer fill (~85ms)
  //            = ~235ms to first audio, regardless of text length
  async function _fetchAudioStreaming(text, signal, onChunk) {
    const url = new URL(TTS_API_URL);
    url.searchParams.set("model", TTS_MODEL);
    url.searchParams.set("encoding", TTS_ENCODING);
    url.searchParams.set("sample_rate", String(TTS_SAMPLE_RATE));
    url.searchParams.set("container", TTS_CONTAINER);

    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const t0 = Date.now();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CHUNK_TIMEOUT);

        // Combine outer abort + per-request timeout
        signal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });

        const res = await fetch(url.toString(), {
          method: "POST",
          headers: {
            Authorization: `Token ${DEEPGRAM_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          let body = "";
          try {
            body = await res.text();
          } catch (_) {}
          throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
        }

        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          let body = "";
          try {
            body = await res.text();
          } catch (_) {}
          throw new Error(`Deepgram returned JSON: ${body.slice(0, 200)}`);
        }

        const reader = res.body.getReader();
        let accumulator = [];
        let accSize = 0;
        let chunkCount = 0;
        let totalBytes = 0;

        while (true) {
          let done, value;
          try {
            ({ done, value } = await reader.read());
          } catch (e) {
            if (e.name === "AbortError") throw e;
            console.error("TTS read error:", e);
            break;
          }

          if (done) break;
          if (!value?.length) continue;

          const chunk = Buffer.from(value);
          accumulator.push(chunk);
          accSize += chunk.length;
          totalBytes += chunk.length;

          // FIX: Flush accumulated bytes once we hit the minimum chunk size.
          // This balances latency (small buffer) vs overhead (not emitting
          // hundreds of tiny 100-byte packets to the client).
          if (accSize >= MIN_CHUNK_BYTES) {
            const merged = Buffer.concat(accumulator);
            onChunk?.(merged);
            chunkCount++;
            accumulator = [];
            accSize = 0;
          }
        }

        // FIX: Flush any remaining bytes (tail of audio stream)
        if (accSize > 0) {
          const merged = Buffer.concat(accumulator);
          onChunk?.(merged);
          chunkCount++;
        }

        const totalTime = Date.now() - t0;
        console.log(
          `📊 TTS stream: ${chunkCount} chunks, ${(totalBytes / 1024).toFixed(1)}KB, ${totalTime}ms`,
        );

        return;
      } catch (err) {
        lastError = err;
        if (err.name === "AbortError") throw err;

        console.warn(
          `⚠️ TTS attempt ${attempt}/${MAX_RETRIES} failed:`,
          err.message,
        );

        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY * attempt));
        }
      }
    }

    throw lastError || new Error("TTS fetch failed after all retries");
  }

  return {
    speakStream,
    abort: () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    },
  };
}

module.exports = { createTTSStream };
