import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command }) => ({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Pin the Nitro preset to node-server. The Docker image builds inside a
    // Bun-only stage (oven/bun) but runs the output under Node (node:slim);
    // left to auto-detect, Nitro sees Bun at build time and emits the `bun`
    // preset (srvx/bun → Bun.serve), which throws "Bun is not defined" the
    // moment Node starts it. Both dev and the runtime target are Node.
    ...(command === "build" ? [(await import("nitro/vite")).nitro({ preset: "node-server" })] : []),
    viteReact(),
  ],
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  // The persistence layer runs under Bun (dev and Docker); keep its sqlite
  // driver out of every bundle so Vite/nitro never try to resolve it.
  ssr: { external: ["bun:sqlite"] },
  build: { rollupOptions: { external: ["bun:sqlite"] } },
  server: { port: 8080 },
}));
