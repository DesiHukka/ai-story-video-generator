// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { splitStoryIntoScenes } = require("./storyToScenes");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND = process.env.FRONTEND;
const FRONTEND_LOCAL = process.env.FRONTEND_LOCAL;

// 1) CORS + JSON body parsing
app.use(cors({ origin: FRONTEND_LOCAL, credentials: true }));
app.use(express.json());

// 2) Ensure our public dirs exist
for (let dir of ["audio", "images", path.join("public", "videos")]) {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
}

// 3) Static asset hosting
app.use("/audio", express.static(path.join(__dirname, "audio")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use("/videos", express.static(path.join(__dirname, "public", "videos")));

// 4) SSE handler factory
function handleGenerateStream(req, res) {
  const { story, type = "kids" } = req.method === "POST" ? req.body : req.query;

  if (!story) {
    res.status(400).end("`story` is required");
    return;
  }

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": FRONTEND_LOCAL,
    "Access-Control-Allow-Credentials": "true",
  });
  res.flushHeaders();

  // Prepare unique output path
  const filename = `video_${Date.now()}.mp4`;
  const outputPath = path.join(__dirname, "public", "videos", filename);

  // Kick off our story→scenes→video pipeline
  splitStoryIntoScenes(story, type, outputPath, (done, total, status) => {
    const pct = Math.round((done / total) * 100);

    // Progress event
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify({ pct, done, total })}\n\n`);

    // Status message event
    res.write(`event: status\n`);
    res.write(`data: ${JSON.stringify({ status })}\n\n`);
  })
    .then(({ scenes, videoPath }) => {
      // Copy TTS files into public/audio
      scenes.forEach((scene) => {
        const src = scene.audio;
        const dest = path.join(
          __dirname,
          "audio",
          `scene_${scene.scene_number}.mp3`
        );
        if (!fs.existsSync(dest)) {
          try {
            fs.copyFileSync(src, dest);
          } catch (err) {
            console.warn(
              `⚠️ Failed to copy audio for scene ${scene.scene_number}`,
              err
            );
          }
        }
      });

      // Emit each scene metadata
      scenes.forEach((scene) => {
        res.write(`event: scene\n`);
        res.write(
          `data: ${JSON.stringify({
            scene_number: scene.scene_number,
            narration: scene.narration,
            description: scene.description,
            audioUrl: `/audio/scene_${scene.scene_number}.mp3`,
            imageUrls: scene.images.map((i) => `/images/${path.basename(i)}`),
          })}\n\n`
        );
      });

      // Final “done” event with video URL
      res.write(`event: done\n`);
      res.write(
        `data: ${JSON.stringify({
          videoUrl: `/videos/${path.basename(videoPath)}`,
        })}\n\n`
      );
      res.end();
    })
    .catch((err) => {
      console.error("❌ /generate-stream error:", err);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    });
}

// 5) Preflight for SSE POST
app.options(
  "/generate-stream",
  cors({ origin: FRONTEND_LOCAL, credentials: true })
);

// 6) SSE endpoints
app.get("/generate-stream", handleGenerateStream);
app.post("/generate-stream", handleGenerateStream);

// 7) Health check
app.get("/health", (_req, res) => res.send("OK"));

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
