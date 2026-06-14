import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Delight-Banking/",
  build: {
    outDir: "docs"
  },
  plugins: [react()]
});
