import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { planStageDiseaseSeedData } from './plan-stage-disease-seed-data';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function getDirectImageLink(url: string): string {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    const reg1 = /[\?&]id=([^&#]+)/;
    const reg2 = /\/d\/([^/]+)/;
    const match1 = url.match(reg1);
    if (match1) return `https://lh3.googleusercontent.com/d/${match1[1]}`;
    const match2 = url.match(reg2);
    if (match2) return `https://lh3.googleusercontent.com/d/${match2[1]}`;
  }
  return url;
}

async function main() {
  // --- Seed Crops ---
  const cropList = [
    "01.Cây Lúa 95-100",
    "02.Cây Lúa Nhật DS1",
    "03.Cây Lúa Nếp",
    "04.Cây cà phê",
    "05.Cây Sầu Riêng",
    "06.Cây Sầu riêng tơ",
    "07.Cây Xoài",
    "08.Cây Xoài ĐL",
    "09.Cây Rau ăn lá",
    "10.Cây Rau ăn củ",
    "11.Cây Rau ăn trái",
    "12.Cây Cà chua",
    "13.Cây dưa hấu",
    "14.Cây hoa cúc",
    "Cây Bắp cải",
    "Cây Cam",
    "Cây Chanh",
    "Cây Chuối",
    "Cây có múi",
    "Cây Đậu",
    "Cây Dâu tây",
    "Cây Điều",
    "Cây Dứa",
    "Cây hành",
    "Cây Hồ Tiêu",
    "Cây khoai tây",
    "Cây Mận",
    "Cây Nhãn",
    "Cây Nho",
    "Cây ớt",
    "Cây Quýt",
    "Cây Táo",
    "Cây Thanh long",
    "Cây Vải"
  ];

  // Clean existing crops if necessary or just upsert
  // The user wants these specific ones, so we might want to clear old ones to match the list exactly
  // await prisma.crop.deleteMany({}); 

  for (const item of cropList) {
    let name = item;
    let sortOrder = 999;
    
    const match = item.match(/^(\d+)\.(.+)$/);
    if (match) {
      sortOrder = parseInt(match[1]);
      name = match[2];
    }

    const cropCode = name.toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '_');

    await prisma.crop.upsert({
      where: { cropCode },
      update: { name, sortOrder },
      create: {
        cropCode,
        name,
        sortOrder,
        isActive: true,
      },
    });
  }

  console.log('Seeded crops successfully');

  // --- Seed Products with Image URLs and Prices from Products.csv ---
  const productsCsvPath = path.join(process.cwd(), 'document', 'Products.csv');
  const productImagesMap = new Map<string, string>();
  const productPricesMap = new Map<string, number>();

  if (fs.existsSync(productsCsvPath)) {
    const fileContent = fs.readFileSync(productsCsvPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as any[];

    console.log(`Found ${records.length} records in Products.csv`);

    for (const record of records) {
      const name = record['Product'];
      let imageLink = record['Image display link'];
      if (imageLink) {
        imageLink = getDirectImageLink(imageLink);
      }
      const priceStr = record['Price'] || '0';
      
      // Parse price, handling potential dots like 1.263.889 -> 1263889
      const normalizedPrice = priceStr.replace(/\./g, '');
      const price = parseFloat(normalizedPrice) || 0;

      if (!name) continue;

      const mapKey = name.toLowerCase().trim();
      if (imageLink) {
        productImagesMap.set(mapKey, imageLink);
      }
      productPricesMap.set(mapKey, price);

      let product = await prisma.product.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });

      const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      let finalSlug = slug;
      let counter = 1;
      if (!product) {
        while (await prisma.product.findUnique({ where: { slug: finalSlug } })) {
          finalSlug = `${slug}-${counter}`;
          counter++;
        }
      }

      const imageUrls = imageLink ? [imageLink] : [];

      if (product) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            imageUrls,
            price: price,
          },
        });
      } else {
        await prisma.product.create({
          data: {
            name,
            sku: `SKU-${finalSlug.toUpperCase()}`,
            slug: finalSlug,
            price: price,
            imageUrls,
            isActive: true,
          },
        });
      }
    }
  }

  // --- Seed Product Details from CSV ---
  const csvFilePath = path.join(process.cwd(), 'document', 'Product details.csv');
  if (fs.existsSync(csvFilePath)) {
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as any[];

    console.log(`Found ${records.length} records in CSV for products.`);

    for (const record of records) {
      const name = record['Name'];
      const plantCrops = record['Plant crops'];
      const type = record['Type'];
      const ingredients = record['Ingredients'];
      const targetDiseases = record['Target Diseases/Nutrient'];
      const usageInstruction = record['Usage Instruction'];
      const description = record['Description'];

      if (!name) continue;

      let product = await prisma.product.findFirst({
        where: { name: { contains: name, mode: 'insensitive' } },
      });

      if (!product) {
        console.log(`Product "${name}" not found, creating skeleton product...`);
        const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
        let finalSlug = slug;
        let counter = 1;
        while (await prisma.product.findUnique({ where: { slug: finalSlug } })) {
          finalSlug = `${slug}-${counter}`;
          counter++;
        }

        const mapKey = name.toLowerCase().trim();
        const imageLink = productImagesMap.get(mapKey);
        const imageUrls = imageLink ? [imageLink] : [];
        const price = productPricesMap.get(mapKey) || 0;

        product = await prisma.product.create({
          data: {
            name,
            sku: `SKU-${finalSlug.toUpperCase()}`,
            slug: finalSlug,
            price,
            imageUrls,
            isActive: true,
          },
        });
      }

      await prisma.productDetail.upsert({
        where: { productId: product.id },
        update: {
          name,
          plantCrops,
          type,
          ingredients,
          targetDiseases,
          usageInstruction,
          description,
        },
        create: {
          productId: product.id,
          name,
          plantCrops,
          type,
          ingredients,
          targetDiseases,
          usageInstruction,
          description,
        },
      });
    }
    console.log('Seeded product details successfully');
  } else {
    console.warn(`CSV file not found at ${csvFilePath}`);
  }

  // --- Seed Plan Stage Diseases (AI reference/training data) ---
  // Backfills the plan_stage_diseases table used by runAiDiagnosis().
  // Idempotent: only seeds when the table is empty so admin edits are never overwritten.
  const existingPlanStageDiseases = await prisma.planStageDisease.count();
  if (existingPlanStageDiseases > 0) {
    console.log(
      `Skipping plan stage disease seed: table already has ${existingPlanStageDiseases} records.`
    );
  } else {
    const planStageData = planStageDiseaseSeedData.map((d) => ({
      cropType: d.cropType,
      growthStage: d.growthStage,
      pestDisease: d.pestDisease,
      detail: d.detail,
      severityLevel: d.severityLevel,
      imageUrls: Array.isArray(d.imageUrl)
        ? d.imageUrl.filter(Boolean)
        : d.imageUrl
          ? [d.imageUrl]
          : [],
      description: d.description ?? '',
      vfcSolution: d.vfcSolution ?? '',
      actionThreshold: d.actionThreshold ?? '',
      pestDensity: d.pestDensity ?? '',
    }));

    const result = await prisma.planStageDisease.createMany({ data: planStageData });
    console.log(`Seeded ${result.count} plan stage disease records.`);
  }

  // --- Enable EarthDistance extension (always) ---
  console.log('Enabling Postgres earthdistance extension...');
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS cube CASCADE;`);
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;`);
    console.log('Postgres earthdistance extension enabled successfully');
  } catch (error) {
    console.error('Failed to enable earthdistance extension:', error);
  }

  // --- Seed Agencies (LOCAL ONLY) ---
  // On server, import document/agencies_export.sql manually instead.
  const isLocal = (process.env.DATABASE_URL || '').includes('localhost');
  if (!isLocal) {
    console.log('⚠️  Skipping agency seed: not local environment.');
    console.log('   → Import agencies_export.sql to the server DB manually.');
  } else {
    const agenciesCsvPath = path.join(process.cwd(), 'document', 'agencies.csv');
    if (fs.existsSync(agenciesCsvPath)) {
      const fileContent = fs.readFileSync(agenciesCsvPath, 'utf-8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as any[];

      console.log(`Found ${records.length} records in agencies.csv`);

      const parseCoord = (val: string): number => {
        if (!val) return 0;
        const normalized = val.replace(/,/g, '.').replace(/[^\d.-]/g, '');
        return parseFloat(normalized) || 0;
      };

      let count = 0;
      for (const record of records) {
        const originalId = record['Id'] || record['id'];
        const code = record['Mã KH'] || record['code'];
        const name = record['Tên'] || record['name'];

        if (!code || !name) continue;

        const phone = record['Điện thoại'] || null;
        const taxCode = record['Mã Số Thuế'] || null;
        const salesman = record['Nhân viên bán hàng'] || null;
        const area = record['Khu vực'] || null;
        const address = record['Địa chỉ'] || null;
        const wardProvince = record['Xã/Tỉnh mới'] || null;

        const latitude = parseCoord(record['Vĩ Độ'] || record['latitude']);
        const longitude = parseCoord(record['Kinh Độ'] || record['longitude']);

        const agencyId = originalId ? String(originalId) : undefined;

        await prisma.agency.upsert({
          where: { code },
          update: {
            name,
            phone,
            taxCode,
            salesman,
            area,
            address,
            latitude,
            longitude,
            wardProvince,
          },
          create: {
            id: agencyId,
            code,
            name,
            phone,
            taxCode,
            salesman,
            area,
            address,
            latitude,
            longitude,
            wardProvince,
          },
        });
        count++;
      }
      console.log(`Successfully seeded ${count} agencies.`);
    } else {
      console.warn(`agencies.csv file not found at ${agenciesCsvPath}`);
    }
  }

  // --- Seed Farmers (LOCAL ONLY) ---
  if (!isLocal) {
    console.log('⚠️  Skipping farmer seed: not local environment.');
  } else {
    const farmersCsvPath = path.join(process.cwd(), 'document', 'farmers1.csv');
    if (fs.existsSync(farmersCsvPath)) {
      const fileContent = fs.readFileSync(farmersCsvPath, 'utf-8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as any[];

      console.log(`Found ${records.length} records in farmers1.csv`);

      const CHUNK = 1000;
      let inserted = 0;
      for (let i = 0; i < records.length; i += CHUNK) {
        const chunk = records.slice(i, i + CHUNK);
        const data = chunk
          .map((record: any) => {
            const name = record['Name'];
            const phone = record['Phone'];
            if (!phone || !name) return null;
            const areaStr = record['Area (ha)'];
            return {
              name,
              phone,
              ward: record['Ward'] || null,
              province: record['Provind'] || null,
              crop: record['Crop'] || null,
              area: areaStr ? parseFloat(String(areaStr).replace(/,/g, '.')) || null : null,
              agencyCode: record['Agency'] || null,
              mdo: record['MDO'] || null,
              se: record['SE'] || null,
            };
          })
          .filter(Boolean) as any[];

        const result = await prisma.farmer.createMany({
          data,
          skipDuplicates: true,
        });
        inserted += result.count;
        process.stdout.write(`\r  Seeded ${i + chunk.length}/${records.length}...`);
      }
      console.log(`\nSuccessfully seeded ${inserted} farmers (skipped duplicates).`);
    } else {
      console.warn(`farmers1.csv file not found at ${farmersCsvPath}`);
    }
  }
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
