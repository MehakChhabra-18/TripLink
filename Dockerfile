# TripLink Backend — Docker Image
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate --schema=./src/prisma/schema.prisma

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S triplink -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src         ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/prisma   ./src/prisma

USER triplink

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
