// src/hooks/useGenerateScenes.js
import { useState } from "react";
import axios from "axios";

export default function useGenerateScenes() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  });

  const run = async (story, type = "kids") => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.post("/generate", { story, type });
      // data.scenes has imageUrls & audioUrl now
      // data.videoUrl points at /videos/...
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { run, loading, error };
}
