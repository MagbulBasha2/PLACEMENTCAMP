import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Expose .env values (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ...) to server code.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    server: { port: 3000 },
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
    },
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      // src/server.ts wraps the SSR entry with error handling.
      tanstackStart({ server: { entry: "server" } }),
      nitro(),
      viteReact(),
    ],
  };
});
