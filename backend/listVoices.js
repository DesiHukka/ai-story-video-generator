const textToSpeech = require("@google-cloud/text-to-speech");

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: "./credentials/google-tts.json", // Make sure this path is correct
});

async function listVoices() {
  const [result] = await client.listVoices({});
  console.log("Available Voices:");
  result.voices.forEach((voice) => {
    console.log(
      `Name: ${voice.name}, Language: ${voice.languageCodes}, Gender: ${voice.ssmlGender}`
    );
  });
}

listVoices();
