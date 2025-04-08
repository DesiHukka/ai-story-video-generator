import React, { useState } from "react";
import {
  TextField,
  Button,
  CircularProgress,
  Box,
  Typography,
} from "@mui/material";
import axios from "axios";

export default function App() {
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoPath, setVideoPath] = useState("");

  const handleSubmit = async () => {
    if (!story.trim()) return;

    setLoading(true);
    setVideoPath("");

    try {
      const response = await axios.post(
        "http://localhost:5000/api/story-to-video",
        { story }
      );
      const { videoPath } = response.data;

      setVideoPath(`http://localhost:5000/${videoPath}`);
    } catch (err) {
      console.error("Error generating video:", err);
      alert("Failed to generate video. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        📜 AI Story to Video Generator
      </Typography>

      <TextField
        label="Enter your story"
        multiline
        rows={6}
        fullWidth
        value={story}
        onChange={(e) => setStory(e.target.value)}
        variant="outlined"
        sx={{ mb: 2 }}
      />

      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={loading}
        sx={{ mb: 3 }}
      >
        {loading ? "Generating..." : "Generate Video"}
      </Button>

      {loading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <CircularProgress />
          <Typography>Processing your story, please wait...</Typography>
        </Box>
      )}

      {videoPath && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">🎥 Your Video:</Typography>
          <video
            src={videoPath}
            controls
            style={{ width: "100%", marginTop: 10 }}
          />
          <Button variant="outlined" href={videoPath} download sx={{ mt: 2 }}>
            Download Video
          </Button>
        </Box>
      )}
    </Box>
  );
}
