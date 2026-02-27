const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const TTS_MODEL = "aura-asteria-en";
const TTS_SAMPLE_RATE = 48000;
const TTS_ENCODING = "linear16";
const TTS_CONTAINER = "none";
const TTS_API_URL = "https://api.deepgram.com/v1/speak";

function createTTSStream() {
  let currentDone = Promise.resolve();

  async function speakStream(text, onChunk) {
    if (!text?.trim()) {
      onChunk?.(null);
      return;
    }

    const fetchPromise = _fetchAudio(text);

    const previousDone = currentDone;
    let resolveDone;
    currentDone = new Promise((res) => {
      resolveDone = res;
    });

    try {
      await previousDone;
      const chunks = await fetchPromise;
      for (const chunk of chunks) {
        onChunk?.(chunk);
      }
    } catch (err) {
      console.error("TTS speakStream error:", err.message);
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
      console.error(`Deepgram TTS HTTP ${res.status}:`, body.slice(0, 200));
      return chunks;
    }

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      let body = "";
      try {
        body = await res.text();
      } catch (_) {}
      console.error(
        "Deepgram TTS returned JSON instead of audio:",
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
        console.error("TTS read error:", e);
        break;
      }
      if (done) break;
      if (!value?.length) continue;
      const chunk = Buffer.from(value);
      if (chunks.length === 0)
        console.log(`TTS first chunk: ${Date.now() - t0}ms  ${chunk.length}b`);
      chunks.push(chunk);
    }

    console.log(`TTS fetched: ${chunks.length} chunks  ${Date.now() - t0}ms`);
    return chunks;
  }

  return { speakStream };
}

module.exports = { createTTSStream };
