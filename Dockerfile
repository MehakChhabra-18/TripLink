# ─────────────────────────────────────────────────────────────
# TripLink Backend — Render-Ready Docker Image
# ─────────────────────────────────────────────────────────────

# ===== Builder Stage =====
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools needed for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files first (layer cache)
COPY package*.json ./

# Copy prisma schema BEFORE install (needed by postinstall → prisma generate)
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

# Install deps — skip postinstall to avoid prisma generate running too early
RUN npm install --legacy-peer-deps --ignore-scripts

# Rebuild native modules (bcrypt, etc.) now that build tools are present
RUN npm rebuild

# Copy all remaining source files
COPY . .

# Generate Prisma Client (all files are present now)
RUN npx prisma generate

# ===== Production Stage =====
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime libs for native modules
RUN apk add --no-cache python3 make g++

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S triplink -u 1001

# Copy built artifacts from builder
COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/src             ./src
COPY --from=builder /app/prisma          ./prisma
COPY --from=builder /app/package.json    ./package.json

# Use non-root user
USER triplink

EXPOSE 3000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
