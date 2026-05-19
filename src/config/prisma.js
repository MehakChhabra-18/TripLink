/**
 * Prisma Client Singleton (Prisma v5)
 * Imports from custom output path: src/generated/prisma
 * DATABASE_URL is read from env via schema's datasource block.
 */
const { PrismaClient } = require("../generated/prisma");

const globalForPrisma = globalThis;

/** @type {PrismaClient} */
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["query", "warn", "error"]
      : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
