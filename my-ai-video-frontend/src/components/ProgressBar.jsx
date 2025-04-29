// src/components/ProgressBar.jsx
import { motion } from "framer-motion";

export default function ProgressBar({ progress }) {
  return (
    <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
      <motion.div
        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ ease: "easeOut", duration: 0.8 }}
      />
    </div>
  );
}
