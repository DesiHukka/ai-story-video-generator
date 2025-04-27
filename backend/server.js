require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { splitStoryIntoScenes } = require("./storyToScenes");

const app = express();
const PORT = process.env.PORT || 3000;

// 1) Middlewares
app.use(cors());
app.use(express.json());

// 2) Serve our TTS audio and generated images as public assets
app.use(
  "/audio",
  express.static(path.join(__dirname, "audio"), { fallthrough: false })
);
app.use(
  "/images",
  express.static(path.join(__dirname, "images"), { fallthrough: false })
);
app.use(
  "/videos",
  express.static(path.join(__dirname, "public", "videos"), {
    fallthrough: false,
  })
);

// 3) Ensure our public/videos folder exists & serve it
const videosDir = path.join(__dirname, "public", "videos");
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

// 4) POST /generate → runs your backend logic, then returns public URLs
app.post("/generate", async (req, res) => {
  try {
    const { story, type = "kids" } = req.body;
    if (!story) return res.status(400).json({ error: "story is required" });

    // make a unique video filename
    const filename = `video_${Date.now()}.mp4`;
    const outputPath = path.join(videosDir, filename);

    // generate scenes + video
    const { scenes } = await splitStoryIntoScenes(story, type, outputPath);

    //  Copy each cached audio into /audio/scene_<scene_number>.mp3
    scenes.forEach((scene) => {
      const src = scene.audio; // e.g. "/backend/cache/abcdef..."
      const destName = `scene_${scene.scene_number}.mp3`;
      const destPath = path.join(__dirname, "audio", destName);
      try {
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(src, destPath);
        }
        // overwrite scene.audio so we know the final filename
        scene.audio = destPath;
      } catch (copyErr) {
        console.warn(
          `⚠️ Failed to copy audio for scene ${scene.scene_number}`,
          copyErr
        );
      }
    });

    // remap each scene’s local file paths → public URLs
    const publicScenes = scenes.map((scene) => {
      // destructure to omit the raw file‐path props if you like:
      const { audio, images, ...keep } = scene;
      return {
        ...keep,
        audioUrl: `/audio/scene_${scene.scene_number}.mp3`,
        imageUrls: images.map((img) => `/images/${path.basename(img)}`),
      };
    });

    // send back JSON
    console.log(outputPath);
    res.json({
      scenes: publicScenes,
      videoUrl: `/videos/${filename}`,
    });
  } catch (err) {
    console.error("❌ /generate error:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
});

// 5) Health check
app.get("/health", (_req, res) => res.send("OK"));

// 6) Start server
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  console.log(`🔗 Videos served from http://localhost:${PORT}/videos/`);
});
