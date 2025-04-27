import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      // this is on by default, but showing for completeness:
      jsxRuntime: "automatic",
    }),
  ],
});
