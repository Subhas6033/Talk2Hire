const { Deepgram } = require("@deepgram/sdk");

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

module.exports = { deepgram };
