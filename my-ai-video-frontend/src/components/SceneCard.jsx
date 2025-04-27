// src/components/SceneCard.jsx
export default function SceneCard({ scene }) {
  console.log(scene);
  return (
    <div className="border rounded p-2">
      <img
        src={scene.images[0]}
        alt=""
        className="w-full h-48 object-cover rounded"
      />
      <p className="mt-2 text-sm">{scene.narration}</p>
      <audio controls src={scene.audio} className="mt-2 w-full" />
    </div>
  );
}
