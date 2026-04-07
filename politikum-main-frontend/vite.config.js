
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_TARGET = process.env.VITE_API_SERVER || "http://localhost:8080";

function hasGitRepo(cwd = ROOT_DIR) {
  return existsSync(path.join(cwd, ".git"));
}

function safeGit(command, { cwd = ROOT_DIR, fallback = "nogit" } = {}) {
  if (!hasGitRepo(cwd)) return fallback;
  try {
    return execSync(command, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim() || fallback;
  } catch {
    return fallback;
  }
}

const GIT_SHA = safeGit("git rev-parse HEAD");
const GIT_SHA_SHORT = safeGit("git rev-parse --short HEAD");
const GIT_BRANCH = safeGit("git rev-parse --abbrev-ref HEAD");

const apiProxy = {
  target: API_TARGET,
  changeOrigin: true,
  secure: false,
  ws: true,
};

export default defineConfig({
  plugins: [react()],
  build: { sourcemap: true },
  server: {
    proxy: {
      "/auth": apiProxy,
      "/public": apiProxy,
      "/admin": apiProxy,
      "/profile": apiProxy,
      "/games": apiProxy,
      "/match": apiProxy,
      "/ws": apiProxy,
    },
  },
  define: {
    __GIT_SHA__: JSON.stringify(GIT_SHA),
    __GIT_SHA_SHORT__: JSON.stringify(GIT_SHA_SHORT),
    __GIT_BRANCH__: JSON.stringify(GIT_BRANCH),
    __ENGINE_GIT_SHA_SHORT__: JSON.stringify("java-backend"),
  },
});
