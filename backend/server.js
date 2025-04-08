const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { splitStoryIntoScenes } = require("./storyToScenes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(cors());

// 🔁 Serve static files from 'output' directory
const outputDir = path.join(__dirname, "output");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
app.use("/output", express.static(outputDir));

// API Endpoint: POST /api/story-to-video
app.post("/api/story-to-video", async (req, res) => {
  try {
    const { story } = req.body;

    if (!story || story.trim().length === 0) {
      return res.status(400).json({ error: "Story content is required" });
    }

    console.log("📖 Received story for processing...");
    fs.writeFileSync("test_story.txt", story);

    // Final video will be saved as output/output_video.mp4
    const finalVideoPath = path.join(outputDir, "output_video.mp4");

    // Create scenes and video
    const { scenes, videoPath } = await splitStoryIntoScenes(
      story,
      finalVideoPath
    );

    // Check video file exists
    if (!fs.existsSync(finalVideoPath)) {
      return res.status(500).json({ error: "Video generation failed" });
    }

    // ✅ Send response with scenes + download path
    return res.json({
      message: "🎬 Video generated successfully",
      videoPath: videoPath
        .replace(__dirname + path.sep, "")
        .replace(/\\/g, "/"),
      scenes,
    });
  } catch (error) {
    console.error("❌ Error in /api/story-to-video:", error.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
