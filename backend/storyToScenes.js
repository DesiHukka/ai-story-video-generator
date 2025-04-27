require("dotenv").config();
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const { synthesizeSpeech } = require("./tts");
const { generateImages } = require("./imageGen");
const { createVideoFromScenes } = require("./createVideoFromScenes");
const { fallbackGenerateImagesChatGPT } = require("./fallbackImageGenChatGPT");
const pLimit = require("p-limit").default;
const { cached } = require("./cache");

// wrap the cached function to log hits/misses
const rawCached = cached;
async function cachedWithLog(key, fn, type) {
  const keyStr = JSON.stringify(key);
  console.log(`🔍 cache lookup for ${keyStr}`);
  // you’ll see here whether the cache module actually retrieves or generates
  const result = await rawCached(key, fn, type);
  console.log(`✅ cache returned for ${keyStr}`);
  return result;
}

const client = new OpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: process.env.OPENAI_API_KEY,
});

// helper: break long story into ≤ maxLen‑char chunks on paragraph boundaries
function chunkStory(story, maxLen = 2000) {
  const paras = story.split(/\n\s*\n/);
  const chunks = [];
  let buffer = "";

  for (let p of paras) {
    if ((buffer + "\n\n" + p).length > maxLen) {
      if (buffer) chunks.push(buffer);
      // paragraph itself might be too big: force push and reset
      buffer = p.length > maxLen ? p.slice(0, maxLen) : p;
    } else {
      buffer = buffer ? buffer + "\n\n" + p : p;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

async function splitStoryIntoScenes(story, type = "kids", outputPath) {
  try {
    if (!story) throw new Error("Story input is required");
    let prompt;
    // 1) chunk the story
    const parts = chunkStory(story, 2000);
    let allScenes = [];
    let sceneOffset = 0;

    for (let i = 0; i < parts.length; i++) {
      const chunk = parts[i];

      // 2) build the prompt for *just* this chunk, telling GPT where to start numbering

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
      // 🧠 Request AI response

      const chatResult = await cachedWithLog(
        ["splitScenes", type, chunk],
        async () => {
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
          return response.choices[0].message.content.trim();
        }
      );

      // 🛠 Clean the response: Remove possible Markdown JSON blocks
      let text = chatResult.replace(/```json|```/g, "");

      // ✅ Parse JSON safely
      let scenes = JSON.parse(text);

      // 3) renumber and accumulate
      scenes = scenes.map((s) => ({
        ...s,
        scene_number: s.scene_number + sceneOffset,
      }));
      allScenes.push(...scenes);
      sceneOffset = allScenes.length;
    }

    // Ensure audio directory exists
    const audioDir = path.join(__dirname, "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir);
    }

    // cap to 4 concurrent tasks
    const limit = pLimit(2);

    // fallback queue of 1 at a time
    const fallbackLimit = pLimit(1);

    // create a task per scene
    const tasks = allScenes.map((scene) =>
      limit(async () => {
        // 1) synthesize narration
        const narrationPath = path.join(
          audioDir,
          `scene_${scene.scene_number}.mp3`
        );

        // returns the path to the file (so that if cached we skip re-generation)

        scene.audio = await cachedWithLog(
          ["tts", scene.ttl || scene.narration],
          async () => {
            await synthesizeSpeech(scene, narrationPath);
            return narrationPath;
          },
          "binary"
        );

        // 2) generate images
        // 2) generate images with 2‑step retry + fallback
        let images = [];
        try {
          // 1️⃣ original prompt

          images = await cachedWithLog(
            ["images", scene.description],
            () => generateImages(scene.description),
            "json"
          );
          if (!images.length) throw new Error("empty");
        } catch (err1) {
          console.warn(
            `⚠️ Scene ${scene.scene_number}: original prompt failed, trying safe twist…`
          );
          try {
            // 2️⃣ “safer” twist
            const safePrompt = `${scene.description}. Please render this scene in a fully family‑friendly, non‑violent style but keep the quality very eye catchy.`;
            images = await generateImages(safePrompt);
            if (!images.length) throw new Error("empty");
          } catch (err2) {
            console.warn(
              `⚠️ Scene ${scene.scene_number}: safe twist also failed — using Puppeteer fallback…`
            );
            // 3️⃣ queued fallback (only one Puppeteer at a time)
            images = await fallbackLimit(() =>
              fallbackGenerateImagesChatGPT(scene.description, 2)
            );
          }
        }

        scene.images = images;
      })
    );

    // fire off up to 4 normal tasks; fallback calls within them will queue down to 1
    await Promise.all(tasks);
    // 4) stitch it all into one video
    await createVideoFromScenes(allScenes, outputPath);
    console.log(`🎥 Final video created at: ${outputPath}`);

    return { scenes: allScenes, videoPath: outputPath };
  } catch (error) {
    console.error("Error generating scenes:", error.message);
    throw new Error("Failed to generate story scenes");
  }
}

// Example test
// const testStory = fs.readFileSync("test_story.txt", "utf-8");

// const outputPath = path.join(__dirname, "final_output.mp4");
// splitStoryIntoScenes(testStory, "kids", outputPath).then((scenes) => {
//   console.log(JSON.stringify(scenes, null, 2));
// });

module.exports = { splitStoryIntoScenes };
