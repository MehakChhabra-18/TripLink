# ─────────────────────────────────────────────
# TripLink Backend — Stable Prisma Dockerfile
# ─────────────────────────────────────────────

# ===== Builder Stage =====
FROM node:20 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy project files
COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema=./prisma/schema.prisma

# ===== Production Stage =====
FROM node:20 AS production

WORKDIR /app

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs triplink

# Copy files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Use non-root user
USER triplink

EXPOSE 3000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]