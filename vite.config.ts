import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // 相対パスで配信（GitHub Pages/ローカルopen対応）
  server: { port: 5173 },
});
