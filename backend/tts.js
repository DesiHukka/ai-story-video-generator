require("dotenv").config();
const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const util = require("util");
const path = require("path");
const client = new textToSpeech.TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

async function synthesizeSpeech(scene, outputFile) {
  console.log(
    `🔊 [TTS] Generating speech for scene ${
      scene.scene_number
    } → ${path.basename(outputFile)}`
  );
  const request = {
    input: { text: scene.narration },
    voice: {
      languageCode: "hi-IN",
      name: "hi-IN-Chirp3-HD-Charon", // You can change voice here
      ssmlGender: "FEMALE",
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: 1,
      pitch: 0,
    },
  };

  const [response] = await client.synthesizeSpeech(request);
  const writeFile = util.promisify(fs.writeFile);
  await writeFile(outputFile, response.audioContent, "binary");
  console.log(`✅ Audio saved as ${outputFile}`);
}
// // Test with custom text
// synthesizeSpeech(
//   `एक बार की बात है, एक छोटे से गाँव में राहुल नाम का एक लड़का रहता था। उसे बारिश बहुत पसंद थी। जैसे ही आसमान में काले बादल छाते, वो भागता हुआ बाहर निकल जाता और कागज़ की नावें बनाकर उन्हें पानी में छोड़ देता।

// एक दिन, जब बहुत ज़ोर की बारिश हो रही थी, राहुल ने अपनी सबसे सुंदर नाव बनाई और उसे बहते पानी में छोड़ दिया। लेकिन अचानक तेज़ हवा चली और नाव एक बड़े गड्ढे में जाकर फँस गई।

// राहुल उदास हो गया। तभी वहाँ एक बुज़ुर्ग दादी आईं, जिनके पास एक छोटी सी छड़ी थी। उन्होंने मुस्कुरा कर कहा, “कभी-कभी हमारी पसंदीदा चीज़ें भी मुश्किलों में पड़ जाती हैं। लेकिन अगर हम कोशिश करें, तो उन्हें वापस पा सकते हैं।”

// दादी ने अपनी छड़ी से नाव को धीरे-धीरे बाहर निकाला और राहुल को वापस दे दी। राहुल की आँखें चमक उठीं।

// उस दिन के बाद, राहुल ने सिर्फ नावें नहीं बनाई — उसने सीखा कि हर परेशानी का हल धैर्य और मदद से निकल सकता है।
// `,
//   "output2_large.mp3"
// );
module.exports = { synthesizeSpeech };
