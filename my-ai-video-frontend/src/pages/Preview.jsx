import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Preview() {
  const [scenes, setScenes] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [showVideo, setShowVideo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const s = sessionStorage.getItem("scenes");
    const v = sessionStorage.getItem("videoPath");
    if (!s) return navigate("/");
    setScenes(JSON.parse(s));
    setVideoUrl(v);
  }, []);

  console.log(videoUrl);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-8">
      <h2 className="text-2xl font-semibold">Preview Scenes</h2>
      {scenes.map((scene) => (
        <div key={scene.scene_number} className="border p-4 rounded-lg">
          <h3 className="font-bold mb-2">Scene {scene.scene_number}</h3>
          <p className="mb-2">{scene.narration}</p>
          {scene.imageUrls?.[0] && (
            <img
              src={import.meta.env.VITE_BACKEND_LOCAL + scene.imageUrls[0]}
              alt={`Scene ${scene.scene_number}`}
              className="w-full rounded"
            />
          )}
          {scene.audioUrl && (
            <audio
              controls
              src={import.meta.env.VITE_BACKEND_LOCAL + scene.audioUrl}
              className="w-full mt-2"
            />
          )}
        </div>
      ))}

      <button
        onClick={() => setShowVideo(true)}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        Stitch Into Video
      </button>

      {showVideo && (
        <video
          controls
          src={import.meta.env.VITE_BACKEND_LOCAL + videoUrl}
          className="w-full mt-6 rounded-lg shadow-lg"
        />
      )}
    </div>
  );
}
