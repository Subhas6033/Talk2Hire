const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const TTS_MODEL = "aura-asteria-en";
const TTS_SAMPLE_RATE = 48000;
const TTS_ENCODING = "linear16";
const TTS_CONTAINER = "none";
const TTS_API_URL = "https://api.deepgram.com/v1/speak";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const CHUNK_TIMEOUT = 30000;

// FIX: Reduced from 8 KB to 4 KB.
//
// At 48 kHz, mono, 16-bit: 1 KB = ~10.9 ms of audio.
//   8 KB  ≈ 87 ms  (old) — user waited almost 90ms for first sound
//   4 KB  ≈ 43 ms  (new) — first audio chunk arrives ~44ms sooner
//
// The tradeoff is slightly more socket.emit() calls to the client, but
// 4 KB per chunk is still large enough to avoid per-packet overhead.
// For ultra-low-latency you could go to 2 KB (~21ms), but 4 KB is the
// sweet spot between latency and network efficiency.
const MIN_CHUNK_BYTES = 4 * 1024; // 4 KB ≈ 43ms at 48kHz mono 16-bit

function createTTSStream() {
  let currentDone = Promise.resolve();
  let abortController = null;

  async function speakStream(text, onChunk) {
    if (!text?.trim()) {
      onChunk?.(null);
      return;
    }

    // Abort any in-flight request immediately so the new one starts without delay
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    // FIX: Start the fetch BEFORE awaiting previousDone so the HTTP handshake
    // to Deepgram begins immediately. The previousDone await only governs when
    // we resolve resolveDone, not when chunks start flowing via onChunk.
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
      onChunk?.(null); // signal stream end
      resolveDone();
      abortController = null;
    }
  }

  // Stream chunks to the client AS they arrive from Deepgram.
  // Latency = TTFB from Deepgram (~150ms) + buffer fill (~43ms) ≈ ~195ms to first audio.
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
        let firstChunkTime = null;

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

          if (accSize >= MIN_CHUNK_BYTES) {
            const merged = Buffer.concat(accumulator);
            if (firstChunkTime === null) {
              firstChunkTime = Date.now() - t0;
              console.log(
                `⚡ TTS first chunk: ${firstChunkTime}ms (${merged.length} bytes)`,
              );
            }
            onChunk?.(merged);
            chunkCount++;
            accumulator = [];
            accSize = 0;
          }
        }

        // Flush any remaining tail bytes — these are real audio that must not be dropped
        if (accSize > 0) {
          const merged = Buffer.concat(accumulator);
          onChunk?.(merged);
          chunkCount++;
        }

        const totalTime = Date.now() - t0;
        console.log(
          `📊 TTS stream complete: ${chunkCount} chunks, ${(totalBytes / 1024).toFixed(1)}KB, ${totalTime}ms total`,
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
