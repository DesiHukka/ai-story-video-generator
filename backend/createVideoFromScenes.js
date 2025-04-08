const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require("uuid");

async function createVideoFromScenes(scenes, outputPath) {
  try {
    const tempDir = path.join(__dirname, "temp_clips");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const getAudioDuration = (audioPath) =>
      new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
          if (err) reject(err);
          else resolve(metadata.format.duration);
        });
      });

    const sceneVideos = [];

    for (const scene of scenes) {
      const images = Array.isArray(scene.images) ? scene.images : [];
      const audio = scene.audio;

      if (!images.length || !audio) continue;

      const sceneVideo = path.join(tempDir, `scene_${scene.scene_number}.mp4`);
      const transitionDuration = 1;

      const verifiedImages = images.filter((imgPath) => fs.existsSync(imgPath));

      if (!verifiedImages.length) continue;

      const audioDuration = await getAudioDuration(audio);

      if (verifiedImages.length === 1) {
        const singleImage = verifiedImages[0];
        const intermediateVideo = path.join(
          tempDir,
          `scene_${scene.scene_number}_images.mp4`
        );

        await new Promise((resolve, reject) => {
          ffmpeg()
            .addInput(singleImage)
            .loop(audioDuration)
            .outputOptions([
              "-t",
              audioDuration.toString(),
              "-vf",
              "scale=1280:720,format=yuv420p",
              "-r",
              "25",
              "-pix_fmt",
              "yuv420p",
            ])
            .save(intermediateVideo)
            .on("end", () => resolve())
            .on("error", reject);
        });

        await new Promise((resolve, reject) => {
          ffmpeg()
            .addInput(intermediateVideo)
            .addInput(audio)
            .outputOptions([
              "-c:v libx264",
              "-c:a aac",
              "-tune stillimage",
              `-t ${audioDuration}`,
            ])
            .save(sceneVideo)
            .on("end", () => {
              sceneVideos.push(sceneVideo);
              resolve();
            })
            .on("error", reject);
        });

        continue;
      }

      const ffmpegPath = require("ffmpeg-static");
      const { spawn } = require("child_process");

      const args = [];
      const durations = [];

      let usedDuration = 0;
      for (let i = 0; i < verifiedImages.length; i++) {
        let duration;
        if (i === verifiedImages.length - 1) {
          duration = audioDuration - usedDuration;
        } else {
          duration = audioDuration / verifiedImages.length;
          usedDuration += duration;
        }
        durations.push(duration);
        args.push(
          "-loop",
          "1",
          "-t",
          duration.toString(),
          "-i",
          path.resolve(verifiedImages[i])
        );
      }

      const filterParts = [];
      let lastOutput = `[0:v]`;
      let cumulativeOffset = durations[0];

      for (let i = 1; i < verifiedImages.length; i++) {
        const curInput = `[${i}:v]`;
        const outLabel = `[vout${i}]`;
        const offset = cumulativeOffset - transitionDuration;
        filterParts.push(
          `${lastOutput}${curInput}xfade=transition=fade:duration=${transitionDuration}:offset=${offset}${outLabel}`
        );
        lastOutput = outLabel;
        cumulativeOffset += durations[i];
      }

      const intermediateVideo = path.join(
        tempDir,
        `scene_${scene.scene_number}_images.mp4`
      );

      await new Promise((resolve, reject) => {
        const fadeProcess = spawn(ffmpegPath, [
          "-y",
          ...args,
          "-filter_complex",
          filterParts.join("; "),
          "-map",
          lastOutput,
          "-fps_mode",
          "cfr",
          "-r",
          "25",
          "-pix_fmt",
          "yuv420p",
          intermediateVideo,
        ]);

        fadeProcess.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`❌ FFmpeg exited with code ${code}`));
        });
      });

      await new Promise((resolve, reject) => {
        ffmpeg()
          .addInput(intermediateVideo)
          .addInput(audio)
          .outputOptions([
            "-c:v libx264",
            "-c:a aac",
            "-tune stillimage",
            `-t ${audioDuration}`,
          ])
          .save(sceneVideo)
          .on("end", () => {
            sceneVideos.push(sceneVideo);
            resolve();
          })
          .on("error", reject);
      });
    }

    if (sceneVideos.length === 0) return;
    if (sceneVideos.length === 1) {
      fs.copyFileSync(sceneVideos[0], outputPath);
      return;
    }

    const listPath = path.join(tempDir, `concat_list.txt`);
    fs.writeFileSync(
      listPath,
      sceneVideos.map((file) => `file '${file}'`).join("\n")
    );

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions("-f", "concat", "-safe", "0")
        .outputOptions("-c", "copy")
        .save(outputPath)
        .on("end", () => resolve())
        .on("error", reject);
    });

    console.log("✅ Final video created at:", outputPath);
    return outputPath;
  } catch (err) {
    console.error("❌ Error in createVideoFromScenes:", err.message);
  }
}

module.exports = { createVideoFromScenes };
