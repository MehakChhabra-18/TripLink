# ─────────────────────────────────────────────────────────────
# TripLink Backend — Optimized Docker Image
# ─────────────────────────────────────────────────────────────

# ===== Builder Stage =====
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDeps needed for prisma generate)
RUN npm install --legacy-peer-deps

# Copy all project files
COPY . .

# Generate Prisma Client → outputs to src/generated/prisma
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
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Use non-root user
USER triplink

# Expose backend port
EXPOSE 3000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "src/server.js"]
