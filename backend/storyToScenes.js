// storyToScenes.js
require("dotenv").config();
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const pLimit = require("p-limit").default;

const { synthesizeSpeech } = require("./tts");
const { generateImages } = require("./imageGen");
const { fallbackGenerateImagesChatGPT } = require("./fallbackImageGenChatGPT");
const { cached } = require("./cache");
const { createVideoFromScenes } = require("./createVideoFromScenes");

const client = new OpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: process.env.OPENAI_API_KEY,
});

// ————————————————————————————————
// 0) Utilities
// ————————————————————————————————

function chunkStory(story, maxLen = 2000) {
  const paras = story.split(/\n\s*\n/);
  const chunks = [];
  let buffer = "";

  for (let p of paras) {
    if ((buffer + "\n\n" + p).length > maxLen) {
      if (buffer) chunks.push(buffer);
      buffer = p.length > maxLen ? p.slice(0, maxLen) : p;
    } else {
      buffer = buffer ? buffer + "\n\n" + p : p;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

async function cachedWithLog(key, fn, type) {
  const keyStr = JSON.stringify(key);
  console.log(`🔍 cache lookup for ${keyStr}`);
  const result = await cached(key, fn, type);
  console.log(`✅ cache returned for ${keyStr}`);
  return result;
}

// ————————————————————————————————
// 1) planScenes: just ask GPT for the raw scene list
// ————————————————————————————————

async function planScenes(story, type = "kids") {
  if (!story) throw new Error("Story input is required");

  const allScenes = [];
  let sceneOffset = 0;

  for (let chunk of chunkStory(story, 2000)) {
    // build the prompt…
    let prompt;
    if (type === "general") {
      prompt = `You are an AI script writer helping generate a video from a story. Your task is to break the story into sequential scenes.

Start numbering at ${sceneOffset + 1}. Each scene should include:
- "scene_number": A number starting from 1.
- "description": A short visual description of what image to show. Keep it clear and specific.
- "narration": The plain text voice-over for the scene.
- "ttl": An SSML-formatted version of the narration. Use expressive speech with prosody, pauses, and emphasis to make the narration sound more human and emotional.

SSML Guidelines for "ttl":
- Use <speak> as the root tag.
- Use <prosody rate="slow"> for slow or dramatic moments.
- Use <emphasis level="moderate"> or <emphasis level="strong"> for key phrases.
- Use <break time="300ms"/> or similar for pauses.
- Keep it natural — don't overdo it.

Return your result as a JSON array of scenes.
Story:
  """
  ${chunk}
  """
  
  Respond **only** with JSON (no additional text). Example format:
  [
    {
      "scene_number": 1,
      "narration": "Narration here...",
      "description": "Visual description here...",
      "ttl": An SSML-formatted version of the narration. Use expressive speech with prosody, pauses, and emphasis to make the narration sound more human and emotional.
    },
    {
      "scene_number": 2,
      "narration": "Narration here...",
      "description": "Visual description here...",
      "ttl": An SSML-formatted version of the narration. Use expressive speech with prosody, pauses, and emphasis to make the narration sound more human and emotional.
    }
  ]`;
    } else {
      prompt = `i will provide you a story. You have to create scenes from it. each scene should contain detailed description in english, which should let dall-e to easily understand and generate proper images. Also, try to give each character same characteristics like what color they are wearing, so that each scene has same type of settings. So, in each scene you will have to redeclare every detail of characters and surroundings again and again. this should make each scene's prompt independent but still alike. Also, try to make description in under 500 characters. Let me give you an example of what each prompt should consider:

characters: provide age, clothes, hair style, color, mood
surrounding: Describe the surrounding irrespective of the previous prompt

in every prompt you have to describe these again but character's visuals should remain mostly same for consistency.

sample prompt:

description 1: A 10-year-old boy named Rahul is standing in a small rural Indian village. He has short black hair, wearing a bright yellow t-shirt and blue shorts. He is barefoot and smiling joyfully. The sky is filled with dark monsoon clouds. Rahul holds a folded paper boat in his hands, ready to place it in the flowing rainwater on the muddy village path. Small huts and greenery surround him.

description 2: Rahul, the 10-year-old boy in a yellow t-shirt and blue shorts, is crouched near a small stream of rainwater running along the muddy village path. He is gently placing a carefully folded white paper boat into the water, watching it with wide eyes. The sky is dark and rain is pouring. A strong wind suddenly blows, and the paper boat is shown drifting toward a large muddy puddle nearby. Trees sway in the background.

description 3:  Rahul, still in his yellow t-shirt and blue shorts, now stands near the large puddle where his boat has gotten stuck. His shoulders are slumped and his face shows sadness. Raindrops continue to fall, and his short black hair is wet. The white paper boat is caught among muddy twigs in the puddle. The quiet village backdrop is blurred by the rain.

note: above prompt is wrong, it lacks useful age details and should be framed like this:

description 3 corrected: Rahul, boy aged 10  in his yellow t-shirt and blue shorts, now stands near the large puddle where his boat has gotten stuck. His shoulders are slumped and his face shows sadness. Raindrops continue to fall, and his short black hair is wet. The white paper boat is caught among muddy twigs in the puddle. The quiet village backdrop is blurred by the rain.

description 4: An elderly Indian woman with gray hair tied in a bun appears beside Rahul. She is wearing a light green saree with a cream shawl, holding a small wooden stick. She smiles warmly at the sad boy. Rahul looks up at her, curious. They both stand beside the puddle with the trapped boat, surrounded by light rain, trees, and distant village huts.

note: above prompt is again wrong.

description 4 corrected: An elderly Indian woman with gray hair tied in a bun appears beside Rahul (a 10 year old boy wearing yellow t-shirt and blue shorts) . She is wearing a light green saree with a cream shawl, holding a small wooden stick. She smiles warmly at the sad boy. Rahul looks up at her, curious. They both stand beside the puddle with the trapped boat, surrounded by light rain, trees, and distant village huts.

Start numbering at ${sceneOffset + 1}. Each scene should include:
- "scene_number": A number starting from 1.
- "description": A short visual description of what image to show. Keep it clear and specific.
- "narration": The plain text voice-over for the scene. It should be the same as provided in the story and should be in the same language. Also try to put atleast 200 characters in narration.

Return your result as a JSON array of scenes.
Story:
  """
  ${chunk}
  """
  
  Respond **only** with JSON (no additional text). Example format:
  [
    {
      "scene_number": 1,
      "narration": "Narration here...",
      "description": "Visual description here...",
    },
    {
      "scene_number": 2,
      "narration": "Narration here...",
      "description": "Visual description here...",
    }
  ]`;
    }

    // call GPT (cached)
    const chatText = await cachedWithLog(
      ["planScenes", type, chunk],
      async () => {
        const resp = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a scriptwriter…" },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        });
        return resp.choices[0].message.content.trim();
      },
      "json"
    );

    // parse JSON
    const jsonText = chatText.replace(/```json|```/g, "");
    const scenes = JSON.parse(jsonText);

    // renumber
    scenes.forEach((s) => (s.scene_number += sceneOffset));
    allScenes.push(...scenes);
    sceneOffset = allScenes.length;
  }

  return allScenes;
}

// ————————————————————————————————
// 2) processScenes: synth + images + fallback + video, with onProgress(stage…)
// ————————————————————————————————

async function processScenes(scenes, outputPath, onProgress = () => {}) {
  // ensure audio dir
  const audioDir = path.join(__dirname, "audio");
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

  const limit = pLimit(2);
  const fallbackLimit = pLimit(1);
  const total = scenes.length;
  let done = 0;

  // for each scene
  await Promise.all(
    scenes.map((scene) =>
      limit(async () => {
        // 1️⃣ start TTS
        onProgress(
          done,
          total,
          `Scene ${scene.scene_number}: synthesizing speech…`
        );
        const narrationPath = path.join(
          audioDir,
          `scene_${scene.scene_number}.mp3`
        );
        scene.audio = await cachedWithLog(
          ["tts", scene.ttl || scene.narration],
          async () => {
            await synthesizeSpeech(scene, narrationPath);
            return narrationPath;
          },
          "binary"
        );

        // 2️⃣ generate images
        onProgress(
          done,
          total,
          `Scene ${scene.scene_number}: generating images…`
        );
        let images = [];
        try {
          images = await cachedWithLog(
            ["images", scene.description],
            () => generateImages(scene.description),
            "json"
          );
          if (!images.length) throw new Error();
        } catch {
          try {
            const safePrompt = `${scene.description}. Please render fully family-friendly.`;
            images = await generateImages(safePrompt);
            if (!images.length) throw new Error();
          } catch {
            images = await fallbackLimit(() =>
              fallbackGenerateImagesChatGPT(scene.description, 2)
            );
          }
        }
        scene.images = images;

        // 3️⃣ done with this scene
        done += 1;
        onProgress(done, total, `Completed scene ${scene.scene_number}`);
      })
    )
  );

  // 4️⃣ finally stitch the video
  onProgress(done, total, "Stitching final video…");
  await createVideoFromScenes(scenes, outputPath);

  return { scenes, videoPath: outputPath };
}

// ————————————————————————————————
// 3) convenience: plan + process in one
// ————————————————————————————————

async function splitStoryIntoScenes(
  story,
  type = "kids",
  outputPath,
  onProgress
) {
  const scenes = await planScenes(story, type);
  return processScenes(scenes, outputPath, onProgress);
}

module.exports = {
  planScenes,
  processScenes,
  splitStoryIntoScenes,
};
