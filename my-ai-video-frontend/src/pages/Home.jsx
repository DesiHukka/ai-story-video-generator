// src/pages/Home.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useGenerateScenes from "../hooks/useGenerateScenes";
import Spinner from "../components/Spinner";
import ProgressBar from "../components/ProgressBar";

export default function Home() {
  const [story, setStory] = useState("");
  const { run, loading, progress, status, error } = useGenerateScenes();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const { scenes, videoUrl } = await run(story, "kids");
      // stash in sessionStorage for Preview/Final to read:
      sessionStorage.setItem("scenes", JSON.stringify(scenes));
      sessionStorage.setItem("videoUrl", videoUrl);
      navigate("/preview");
    } catch {
      // error state is already handled by the hook
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">AI Video Creator</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <textarea
          rows={8}
          className="w-full p-2 border rounded"
          placeholder="Paste your story here…"
          value={story}
          onChange={(e) => setStory(e.target.value)}
        />

        <div className="space-y-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? <Spinner /> : "Generate Scenes"}
          </button>

          {loading && (
            <div className="mt-2">
              <ProgressBar progress={progress} />
              <p className="mt-1 text-sm text-gray-600">{status}</p>
            </div>
          )}
        </div>

        {error && <p className="text-red-500">Error: {error.message}</p>}
      </form>
    </div>
  );
}
