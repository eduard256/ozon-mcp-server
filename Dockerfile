# Ozon MCP server — stdio. Uses the official Playwright image (Chromium + all system deps).
FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

# Install production deps (browser binaries already present in the base image).
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY src/ ./src/

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production

# stdio transport: the MCP client spawns the container with `-i`. No port is exposed.
# Run with:  docker run -i --rm --init --shm-size=1g ozon-mcp-server
# Exec form → node is PID-forwarded SIGTERM by --init's tini for clean browser shutdown.
ENTRYPOINT ["node", "src/index.js"]
