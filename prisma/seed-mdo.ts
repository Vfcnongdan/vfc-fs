import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";
import * as fs from 'fs';
import * as path from 'path';

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
  const mdoCsvPath = path.join(process.cwd(), 'document', 'mdo.csv');
  if (!fs.existsSync(mdoCsvPath)) {
    console.error(`File not found: ${mdoCsvPath}`);
    return;
  }

  const content = fs.readFileSync(mdoCsvPath, 'utf8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',');
    if (parts.length < 5) continue;

    const [name, employeeCode, region, check, rawPhone] = parts;

    const core = extractPhoneCore(rawPhone);
    if (!core) {
      console.warn(`Invalid phone ${rawPhone} for MDO ${name}`);
      continue;
    }
    const phone = `0${core}`;

    await prisma.mdo.upsert({
      where: { employeeCode },
      update: {
        name,
        region,
        check,
        phone,
      },
      create: {
        name,
        employeeCode,
        region,
        check,
        phone,
      },
    });
    count++;
  }

  console.log(`Successfully seeded ${count} MDO records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
