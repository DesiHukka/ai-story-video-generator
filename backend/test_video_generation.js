const fs = require("fs");
const path = require("path");
const { createVideoFromScenes } = require("./createVideoFromScenes");

// Load a sample scenes JSON
const scenes = JSON.parse(fs.readFileSync("test_scenes.json", "utf-8"));

const outputPath = path.join(__dirname, "final_video.mp4");

createVideoFromScenes(scenes, outputPath);
