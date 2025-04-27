// src/pages/Final.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Final() {
  const [videoUrl, setVideoUrl] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const vp = sessionStorage.getItem("videoPath");
    if (!vp) return navigate("/");
    setVideoUrl(vp);
  }, [navigate]);

  if (!videoUrl) return null;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Your Final Video</h2>
      <video src={videoUrl} controls className="w-full rounded shadow-lg" />
    </div>
  );
}
