# ─────────────────────────────────────────────────────────────
# TripLink Backend — Optimized Docker Image
# ─────────────────────────────────────────────────────────────

# ===== Builder Stage =====
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

# Install dependencies — skip postinstall (prisma generate runs separately below)
RUN npm install --legacy-peer-deps --ignore-scripts

# Copy remaining source files
COPY . .

# Generate Prisma Client (schema + files are now all present)
RUN npx prisma generate

# ===== Production Stage =====
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S triplink -u 1001

# Copy required files from builder
COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/src             ./src
COPY --from=builder /app/prisma          ./prisma
COPY --from=builder /app/package.json    ./package.json

# Use non-root user
USER triplink

# Expose backend port
EXPOSE 3000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "src/server.js"]
