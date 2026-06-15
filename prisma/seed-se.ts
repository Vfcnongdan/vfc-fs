import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function extractPhoneCore(phone: string): string | null {
  const normalized = phone.trim().replace(/[\s-]/g, "");
  const withoutPrefix = normalized.replace(/^(?:\+?84|0)/, "");
  const match = /^([3-9]\d{8})$/.exec(withoutPrefix);
  return match ? match[1] : null;
}

async function main() {
  const seCsvPath = path.join(process.cwd(), 'document', 'se.csv');
  if (!fs.existsSync(seCsvPath)) {
    console.error(`File not found: ${seCsvPath}`);
    return;
  }

  const content = fs.readFileSync(seCsvPath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as any[];

  let count = 0;
  for (const record of records) {
    const employeeCode = record['Mã nhân viên'];
    const name = record['Ho,Tên'];
    const region = record['Vùng/Bộ Phận'];
    const area = record['Khu vực'];
    const location = record['Địa bàn'];
    const rawPhone = record['Di động'];
    const email = record['Email'] || null;

    if (!employeeCode || !name || !rawPhone) continue;

    const core = extractPhoneCore(rawPhone);
    if (!core) {
      console.warn(`Invalid phone ${rawPhone} for SE ${name}`);
      continue;
    }
    const phone = `0${core}`;

    try {
      await prisma.se.upsert({
        where: { employeeCode },
        update: {
          name,
          region,
          area,
          location,
          phone,
          email,
        },
        create: {
          employeeCode,
          name,
          region,
          area,
          location,
          phone,
          email,
        },
      });
      count++;
    } catch (e: any) {
      console.warn(`Could not insert SE ${name} (${employeeCode}) with phone ${phone}:`, e.message);
    }
  }

  console.log(`Successfully seeded ${count} SE records.`);
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
