const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");

// Point fluent-ffmpeg at the static binary
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Create a video sequence from scene images and audio tracks.
 * @param {Array} scenes - Array of { scene_number, images: [paths], audio: path }
 * @param {string} outputPath - Final output .mp4 path
 */
async function createVideoFromScenes(scenes, outputPath) {
  try {
    const tempDir = path.join(__dirname, "temp_clips");
    fs.mkdirSync(tempDir, { recursive: true });

    // Helper to probe audio length
    const getAudioDuration = (audioPath) =>
      new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, meta) =>
          err ? reject(err) : resolve(meta.format.duration)
        );
      });

    const sceneVideos = [];

    for (const scene of scenes) {
      const imgs = (scene.images || []).filter((f) => fs.existsSync(f));
      if (!imgs.length || !fs.existsSync(scene.audio)) continue;

      const audioDur = await getAudioDuration(scene.audio);
      const sceneOut = path.join(tempDir, `scene_${scene.scene_number}.mp4`);

      // Single-image: just loop it
      if (imgs.length === 1) {
        await new Promise((res, rej) => {
          ffmpeg()
            .addInput(imgs[0])
            .loop(audioDur)
            .addInput(scene.audio)
            .outputOptions([
              "-vf",
              "scale=1280:720,format=yuv420p",
              "-c:v",
              "libx264",
              "-c:a",
              "aac",
              "-tune",
              "stillimage",
              "-t",
              audioDur.toString(),
              "-r",
              "25",
            ])
            .save(sceneOut)
            .on("end", () => (sceneVideos.push(sceneOut), res()))
            .on("error", rej);
        });
        continue;
      }

      // Multi-image: use xfade transitions
      const minSec = 3;
      let slots = Math.floor(audioDur / minSec);
      slots = Math.max(1, Math.min(slots, imgs.length));
      const picked = imgs.slice(0, slots);

      // Revert to single-image logic if only one slot
      if (picked.length === 1) {
        await new Promise((res, rej) => {
          ffmpeg()
            .addInput(picked[0])
            .loop(audioDur)
            .addInput(scene.audio)
            .outputOptions([
              "-vf",
              "scale=1280:720,format=yuv420p",
              "-c:v",
              "libx264",
              "-c:a",
              "aac",
              "-tune",
              "stillimage",
              "-t",
              audioDur.toString(),
              "-r",
              "25",
            ])
            .save(sceneOut)
            .on("end", () => (sceneVideos.push(sceneOut), res()))
            .on("error", rej);
        });
        continue;
      }

      // Evenly split durations
      const segDur = [];
      let acc = 0;
      for (let i = 0; i < picked.length; i++) {
        const d =
          i === picked.length - 1 ? audioDur - acc : audioDur / picked.length;
        segDur.push(d);
        acc += d;
      }

      // Build inputs & filters
      const args = [];
      picked.forEach((img, i) => {
        args.push(
          "-loop",
          "1",
          "-t",
          segDur[i].toString(),
          "-i",
          path.resolve(img)
        );
      });
      args.push("-i", scene.audio);

      // Scale labels
      const scales = picked
        .map((_, i) => `[${i}:v]scale=1280:720,format=yuv420p[fv${i}]`)
        .join(";");
      // Chain xfade
      let filter = scales;
      let prev = "[fv0]";
      let offset = segDur[0];
      for (let i = 1; i < picked.length; i++) {
        const cur = `[fv${i}]`;
        const out = i === picked.length - 1 ? "[vout]" : `[x${i}]`;
        const start = Math.max(offset - 1, 0);
        filter += `;${prev}${cur}xfade=duration=1:offset=${start}${out}`;
        prev = out;
        offset += segDur[i];
      }

      // Run xfade -> intermediate
      const interm = path.join(tempDir, `scene_${scene.scene_number}_img.mp4`);
      await new Promise((res, rej) => {
        const proc = spawn(
          ffmpegPath,
          [
            "-y",
            ...args,
            "-filter_complex",
            filter,
            "-map",
            "[vout]",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-r",
            "25",
            interm,
          ],
          { stdio: ["ignore", "ignore", "inherit"] }
        );
        proc.on("close", (code) =>
          code === 0 ? res() : rej(new Error("xfade failed"))
        );
      });

      // Merge audio
      await new Promise((res, rej) => {
        ffmpeg()
          .addInput(interm)
          .addInput(scene.audio)
          .outputOptions([
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-t",
            audioDur.toString(),
          ])
          .save(sceneOut)
          .on("end", () => (sceneVideos.push(sceneOut), res()))
          .on("error", rej);
      });
    }

    // Concatenate all scenes
    if (!sceneVideos.length) return;
    if (sceneVideos.length === 1) {
      fs.copyFileSync(sceneVideos[0], outputPath);
      return;
    }
    const list = path.join(tempDir, "concat.txt");
    fs.writeFileSync(list, sceneVideos.map((f) => `file '${f}'`).join("\n"));
    await new Promise((res, rej) => {
      ffmpeg()
        .input(list)
        .inputOptions("-f", "concat", "-safe", "0")
        .outputOptions("-c", "copy")
        .save(outputPath)
        .on("end", res)
        .on("error", rej);
    });

    console.log(`✅ Video built at ${outputPath}`);
  } catch (e) {
    console.error("❌ createVideoFromScenes error:", e);
  }
}

module.exports = { createVideoFromScenes };
