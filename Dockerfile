# ─────────────────────────────────────────────────────────────
# TripLink Backend — Render-Ready Docker Image (Prisma v5)
# ─────────────────────────────────────────────────────────────

FROM node:20

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema BEFORE npm install
# (postinstall: prisma generate --schema=./prisma/schema.prisma)
COPY prisma ./prisma

# Install all dependencies
RUN npm install --legacy-peer-deps

# Copy remaining source files
COPY . .

# Re-generate Prisma Client after full source copy
# (ensures generated files reflect final state)
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 3000

# Run DB migrations then start server
# (free-tier alternative to Render's paid Pre-Deploy Command)
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node src/server.js"]