import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let connectionString = process.env.DATABASE_URL;
if (connectionString && !connectionString.includes("uselibpqcompat=true")) {
  const separator = connectionString.includes("?") ? "&" : "?";
  connectionString = `${connectionString}${separator}uselibpqcompat=true`;
}

const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on("error", (err: any) => {
  if (
    err?.code === "ECONNRESET" ||
    err?.message?.includes("ECONNRESET") ||
    err?.syscall === "read"
  ) {
    return;
  }
  console.error("[PgPool Error]", err);
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
