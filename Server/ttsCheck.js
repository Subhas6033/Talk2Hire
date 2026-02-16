// test-tts.js
const { createTTSStream } = require("./Service/tts.service.js");

async function test() {
  const tts = createTTSStream();

  let chunkCount = 0;
  await tts.speakStream("Hello, this is a test", (chunk) => {
    if (chunk) {
      chunkCount++;
      console.log(`Chunk ${chunkCount}: ${chunk.length} bytes`);
    } else {
      console.log(`Done! Received ${chunkCount} chunks total`);
    }
  });
}

test();
