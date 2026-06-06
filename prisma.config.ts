import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Prefer DATABASE_URL (pgbouncer) because DIRECT_URL may be unreachable in dev.
    url: (process.env.DATABASE_URL || process.env.DIRECT_URL)!,
    directUrl: (process.env.DIRECT_URL || process.env.DATABASE_URL)!,
  } as any,
});
