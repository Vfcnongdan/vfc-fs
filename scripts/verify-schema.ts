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
  // Check table columns via information_schema
  const result = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'product_details' 
    ORDER BY ordinal_position
  `);
  console.log('=== product_details table columns ===');
  console.log(JSON.stringify(result, null, 2));

  // Check foreign key constraints
  const fks = await prisma.$queryRawUnsafe(`
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'product_details' AND tc.constraint_type = 'FOREIGN KEY'
  `);
  console.log('\n=== Foreign Keys ===');
  console.log(JSON.stringify(fks, null, 2));

  // Check unique constraints
  const uniq = await prisma.$queryRawUnsafe(`
    SELECT tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'product_details' AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
  `);
  console.log('\n=== Unique/PK Constraints ===');
  console.log(JSON.stringify(uniq, null, 2));

  // Verify data integrity: count + sample
  const count = await prisma.productDetail.count();
  console.log(`\n=== Data integrity ===`);
  console.log(`Total product_details: ${count}`);

  const sample = await prisma.productDetail.findFirst({
    include: { product: { select: { id: true, name: true } } },
  });
  console.log('Sample row:', JSON.stringify(sample, null, 2));

  // Check if any product has detail relation working
  const productWithDetail = await prisma.product.findFirst({
    where: { detail: { isNot: null } },
    select: { id: true, name: true, detail: true },
  });
  console.log('\nProduct with detail (relation test):', JSON.stringify(productWithDetail, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
