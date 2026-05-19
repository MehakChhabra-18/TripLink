# ===== Builder Stage =====
FROM node:20 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# IMPORTANT: copy prisma before npm install
COPY prisma ./prisma

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy remaining project files
COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema=./prisma/schema.prisma