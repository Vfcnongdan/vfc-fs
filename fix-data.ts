import { prisma } from './src/lib/prisma';
import { planStageDiseaseSeedData } from './prisma/plan-stage-disease-seed-data';

async function main() {
  console.log('Đang tìm các bản ghi bị lỗi (cropType là CUID)...');
  
  const corruptedRecords = await prisma.planStageDisease.findMany({
    where: {
      cropType: {
        startsWith: 'c',
        // CUID usually has 25 chars
      }
    }
  });

  const corruptedCount = corruptedRecords.filter(r => r.cropType.length >= 24).length;

  if (corruptedCount > 0) {
    console.log(`Phát hiện ${corruptedCount} bản ghi bị lỗi cột. Đang xóa...`);
    await prisma.planStageDisease.deleteMany({
      where: {
        cropType: {
          startsWith: 'c'
        }
      }
    });
    console.log('Đã xóa dữ liệu lỗi.');
  }

  const existingCount = await prisma.planStageDisease.count();
  if (existingCount === 0) {
    console.log('Bảng PlanStageDisease trống. Đang nạp lại dữ liệu gốc...');
    
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
    console.log(`Đã nạp lại ${result.count} bản ghi dữ liệu gốc.`);
  } else {
    console.log(`Bảng vẫn còn ${existingCount} bản ghi hợp lệ.`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
