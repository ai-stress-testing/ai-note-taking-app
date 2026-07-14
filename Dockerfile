# Build with Bun (fast installs, runs the repo's own scripts), serve with
# Node 22 (node:sqlite built in — zero native deps to compile). Pinned
# digests-by-tag so the image builds the same everywhere.
FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEUROVIM_DATA_DIR=/data \
    PORT=8080 \
    HOST=0.0.0.0
COPY --from=build /app/.output ./.output
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
