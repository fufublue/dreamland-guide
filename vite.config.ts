import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { VitePWA } from "vite-plugin-pwa";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

// 取得 dataVersions.ts 最後一次修改的日期
const dataVersionDate = execFileSync(
  "git",
  ["log", "-1", "--format=%cs", "--", "src/data/dataVersions.ts"],
  { encoding: "utf-8" },
).trim();

export default defineConfig({
  base: "/dreamland-guide/",

  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      includeAssets: ["favicon.svg"],

      manifest: {
        name: "夢樂園資料站",
        short_name: "夢樂園",
        description: "夢樂園遊戲資料與實用工具整理站",
        lang: "zh-TW",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/dreamland-guide/",
        scope: "/dreamland-guide/",

        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        globIgnores: ["**/data/images/**"],
      },
    }),
  ],

  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __DATA_VERSION_DATE__: JSON.stringify(dataVersionDate),
  },
});
