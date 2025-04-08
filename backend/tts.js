require("dotenv").config();
const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const util = require("util");

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: GOOGLE_APPLICATION_CREDENTIALS,
});

function convertToSSML(text) {
  // Split into sentences and insert a break after each
  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .filter(Boolean)
    .map((sentence) => sentence.trim());

  const ssmlBody = sentences
    .map((sentence) => `${sentence} <break time="0.5s"/>`)
    .join(" ");

  return `<speak>${ssmlBody}</speak>`;
}

async function synthesizeSpeech(text, outputFile) {
  const ssml = convertToSSML(text);

  const request = {
    input: { ssml },
    voice: {
      languageCode: "en-IN",
      name: "en-IN-Wavenet-A", // You can change voice here
      ssmlGender: "MALE",
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: 1.0,
      pitch: 0,
    },
  };

  const [response] = await client.synthesizeSpeech(request);
  const writeFile = util.promisify(fs.writeFile);
  await writeFile(outputFile, response.audioContent, "binary");
  console.log(`✅ Audio saved as ${outputFile}`);
}
// // Test with custom text
// synthesizeSpeech("Hello, this is a natural-sounding AI voice!", "output.mp3");
module.exports = { synthesizeSpeech };
