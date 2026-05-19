# ─────────────────────────────────────────────────────────────
# TripLink Backend — Render-Ready Docker Image
# Single-stage build (avoids multi-stage copy issues)
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

# Install native build tools (needed for bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Copy prisma schema BEFORE npm install
# (postinstall runs `prisma generate` which needs the schema)
COPY prisma ./prisma
COPY prisma.config.js ./prisma.config.js

# Install all dependencies (postinstall: prisma generate runs here)
RUN npm install --legacy-peer-deps

# Copy rest of source files
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S triplink -u 1001

USER triplink

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
