// src/hooks/useGenerateScenes.js
import { useState, useCallback } from "react";

export default function useGenerateScenes() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(""); // ← new
  const [error, setError] = useState(null);

  const run = useCallback((story, type = "kids") => {
    setLoading(true);
    setProgress(0);
    setStatus(""); // reset status
    setError(null);

    return new Promise((resolve, reject) => {
      const scenes = [];
      const params = new URLSearchParams({ story, type });
      const url = `${import.meta.env.VITE_BACKEND}/generate-stream?${params}`;
      const es = new EventSource(url, { withCredentials: true });

      // Progress %
      es.addEventListener("progress", (e) => {
        try {
          const { pct } = JSON.parse(e.data);
          setProgress(pct);
        } catch {}
      });

      // Human‐readable status
      es.addEventListener("status", (e) => {
        try {
          const { status: msg } = JSON.parse(e.data);
          setStatus(msg);
        } catch {}
      });

      // Each scene chunk
      es.addEventListener("scene", (e) => {
        try {
          const scene = JSON.parse(e.data);
          scenes.push(scene);
        } catch {}
      });

      // Final done
      es.addEventListener("done", (e) => {
        es.close();
        setProgress(100);
        setLoading(false);
        try {
          const { videoUrl } = JSON.parse(e.data);
          resolve({ scenes, videoUrl });
        } catch (err) {
          reject(err);
        }
      });

      // Error
      es.addEventListener("error", (e) => {
        es.close();
        setLoading(false);
        let msg = "Unknown error";
        try {
          const payload = JSON.parse(e.data);
          msg = payload.message || msg;
        } catch {}
        const err = new Error(msg);
        setError(err);
        reject(err);
      });
    });
  }, []);

  return { run, loading, progress, status, error }; // ← expose status
}
