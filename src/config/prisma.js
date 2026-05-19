/**
 * Prisma Client Singleton
 * Prevents multiple PrismaClient instances in development (hot-reload)
 */
const { PrismaClient } = require("../generated/prisma");

const globalForPrisma = globalThis;

/** @type {PrismaClient} */
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
