/**
 * Prisma Client Singleton — Prisma v7
 *
 * In Prisma v7, `url` is removed from schema's datasource block.
 * The DATABASE_URL must be passed explicitly via the `datasources`
 * constructor option at runtime.
 */
const { PrismaClient } = require("../generated/prisma");

const globalForPrisma = globalThis;

/** @type {PrismaClient} */
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Prisma v7: pass DATABASE_URL here since schema has no `url` field
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
    log: process.env.NODE_ENV === "development"
      ? ["query", "warn", "error"]
      : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
