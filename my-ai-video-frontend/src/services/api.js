// src/services/api.js
import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

export function generateScenes(story, type = "kids") {
  return client.post("/generate", { story, type }).then((res) => res.data); // { scenes: [...], videoPath: '...' }
}
