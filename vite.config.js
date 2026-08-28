import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isVercel = Boolean(process.env.VERCEL);

export default defineConfig({
  base: isVercel ? "/" : "/Delight-Banking/",
  build: {
    outDir: isVercel ? "dist" : "docs"
  },
  plugins: [react()]
});
