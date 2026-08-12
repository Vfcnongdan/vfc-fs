import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
  console.log(JSON.stringify(products, null, 2));
  console.log(`\nTotal products: ${products.length}`);

  const detailCount = await prisma.productDetail.count();
  console.log(`Product details count: ${detailCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
