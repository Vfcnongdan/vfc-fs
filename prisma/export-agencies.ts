import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";
import * as fs from "fs";
import path from "path";

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const agencies = await prisma.agency.findMany();
  console.log(`Exporting ${agencies.length} agencies...`);

  // Generate SQL INSERT statements
  const lines: string[] = [
    `-- agencies export (${new Date().toISOString()})`,
    `-- Run: psql $DATABASE_URL -f agencies_export.sql`,
    ``,
    `TRUNCATE TABLE agencies RESTART IDENTITY CASCADE;`,
    ``,
  ];

  for (const a of agencies) {
    const escape = (v: string | null) =>
      v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

    lines.push(
      `INSERT INTO agencies (id, code, name, phone, tax_code, salesman, area, address, latitude, longitude, ward_province, created_at, updated_at) VALUES ` +
        `(${escape(a.id)}, ${escape(a.code)}, ${escape(a.name)}, ${escape(a.phone)}, ${escape(a.taxCode)}, ${escape(a.salesman)}, ${escape(a.area)}, ${escape(a.address)}, ${a.latitude}, ${a.longitude}, ${escape(a.wardProvince)}, '${a.createdAt.toISOString()}', '${a.updatedAt.toISOString()}');`
    );
  }

  const outPath = path.join(process.cwd(), "document", "agencies_export.sql");
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`✅ Exported to ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
