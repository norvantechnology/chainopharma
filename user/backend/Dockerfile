# Medico User Backend — local Express adapter (SAM handlers)
FROM node:22-bookworm-slim

WORKDIR /app

# System deps for native modules / PDF / Chromium (puppeteer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    STAGE=local \
    PORT=4000 \
    PUPPETEER_SKIP_DOWNLOAD=false

# Install root deps first (better layer cache)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Optional Lambda layer deps used by some handlers
COPY lib/nodejs-light/nodejs/package.json lib/nodejs-light/nodejs/package-lock.json ./lib/nodejs-light/nodejs/
RUN cd lib/nodejs-light/nodejs && npm ci --omit=dev || true

COPY . .

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/hello',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "local-server.js"]
