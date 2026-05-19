require("dotenv").config();

// prisma.config.js — Prisma v7 configuration
// Provides database URL for Prisma Migrate commands.
// Runtime URL is passed via PrismaClient constructor in src/config/prisma.js
module.exports = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
