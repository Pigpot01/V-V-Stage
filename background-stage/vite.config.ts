import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@chub-ai/stages-ts": fileURLToPath(
        new URL("../node_modules/@chub-ai/stages-ts", import.meta.url),
      ),
      react: fileURLToPath(new URL("../node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(new URL("../node_modules/react-dom", import.meta.url)),
      "react/jsx-runtime": fileURLToPath(
        new URL("../node_modules/react/jsx-runtime.js", import.meta.url),
      ),
    },
  },
});
