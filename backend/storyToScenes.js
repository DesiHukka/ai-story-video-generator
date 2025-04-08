require("dotenv").config();
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const { synthesizeSpeech } = require("./tts");
const { generateImages } = require("./imageGen");
const { createVideoFromScenes } = require("./createVideoFromScenes");

// OpenAI Setup
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const client = new OpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: OPENAI_API_KEY,
});

async function splitStoryIntoScenes(story, outputPath) {
  try {
    if (!story) throw new Error("Story input is required");

    const prompt = `Break the following story into detailed sequential scenes in JSON format. Each scene should have:
    - "narration": A short paragraph that describes the scene as if telling a story, ensuring it takes at least 4 seconds to read naturally.
    - "description": A visual description of what is happening in the scene.

    Story:
    """
    ${story}
    """
    
    Respond **only** with JSON (no additional text). Example format:
    [
      {
        "scene_number": 1,
        "narration": "Narration here...",
        "description": "Visual description here..."
      },
      {
        "scene_number": 2,
        "narration": "Narration here...",
        "description": "Visual description here..."
      }
    ]`;

    // 🧠 Request AI response
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a scriptwriter who structures stories into sequential scenes.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    // 🛠 Clean the response: Remove possible Markdown JSON blocks
    let aiResponse = response.choices[0].message.content.trim();
    aiResponse = aiResponse.replace(/```json|```/g, ""); // Remove markdown formatting if present

    // ✅ Parse JSON safely
    const formattedScenes = JSON.parse(aiResponse);
    // Ensure audio directory exists
    const audioDir = path.join(__dirname, "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir);
    }

    for (let scene of formattedScenes) {
      // 🔊 Generate audio
      const audioFilePath = path.join(
        audioDir,
        `scene_${scene.scene_number}.mp3`
      );
      await synthesizeSpeech(scene.narration, audioFilePath);
      scene.audio = audioFilePath;

      // 🖼 Generate images
      let images = [];
      try {
        images = await generateImages(scene.description);
        if (!images.length) throw new Error("No images returned");
      } catch (err) {
        console.warn(
          `⚠️ Scene ${scene.scene_number} failed Bing moderation. Retrying with a generic prompt.`
        );
        const fallbackPrompt = `A scenic, artistic, and safe background for a storytelling video.`;
        try {
          images = await generateImages(fallbackPrompt);
        } catch (fallbackErr) {
          console.error(
            `❌ Fallback also failed for scene ${scene.scene_number}:`,
            fallbackErr.message
          );
          images = [];
        }
      }
      scene.images = images;
    }

    // 🔄 Create final video at specified path
    await createVideoFromScenes(formattedScenes, outputPath);
    console.log(`🎥 Final video created at: ${outputPath}`);

    return { scenes: formattedScenes, videoPath: outputPath };
  } catch (error) {
    console.error("Error generating scenes:", error.message);
    throw new Error("Failed to generate story scenes");
  }
}

// Example test
// const testStory = fs.readFileSync("test_story.txt", "utf-8");

// splitStoryIntoScenes(testStory).then((scenes) => {
//   console.log(JSON.stringify(scenes, null, 2));
// });

module.exports = { splitStoryIntoScenes };
