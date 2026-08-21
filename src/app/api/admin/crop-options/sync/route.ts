import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { invalidateCropOptionsCache } from "@/lib/cropOptions";
import type { CropGrowthStageOptions } from "@/lib/deseaseDetails";

const CONFIG_KEY = "crop-options";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") return apiError("UNAUTHORIZED", 401);

  try {
    // Query tất cả records, chỉ lấy 4 cột cần thiết
    const records = await prisma.planStageDisease.findMany({
      select: {
        cropType: true,
        growthStage: true,
        pestDisease: true,
        severityLevel: true,
      },
    });

    // Group by cropType → derive unique arrays
    const grouped = new Map<
      string,
      { stages: Set<string>; pests: Set<string>; severities: Set<string> }
    >();

    for (const r of records) {
      if (!grouped.has(r.cropType)) {
        grouped.set(r.cropType, {
          stages: new Set(),
          pests: new Set(),
          severities: new Set(),
        });
      }
      const g = grouped.get(r.cropType)!;
      if (r.growthStage) g.stages.add(r.growthStage);
      if (r.pestDisease) g.pests.add(r.pestDisease);
      if (r.severityLevel) g.severities.add(r.severityLevel);
    }

    const options: CropGrowthStageOptions[] = Array.from(
      grouped.entries(),
    ).map(([cropType, g]) => ({
      cropType,
      growthStages: [...g.stages],
      pestDiseases: [...g.pests],
      severityLevels: [...g.severities],
    }));

    // Lưu vào DB (upsert)
    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: options as any },
      create: { key: CONFIG_KEY, value: options as any },
    });

    // Đồng bộ bảng crops dựa vào crop-options
    const activeCropNames = options.map((o) => o.cropType);

    for (const cropName of activeCropNames) {
      const existingCrop = await prisma.crop.findFirst({
        where: { name: cropName },
      });

      if (existingCrop) {
        // 1. Nếu bảng crops đã có cây đó (name) thì kiểm tra is_active phải bật true
        if (!existingCrop.isActive) {
          await prisma.crop.update({
            where: { id: existingCrop.id },
            data: { isActive: true },
          });
        }
      } else {
        // 2. Nếu bảng crops chưa có cây đó thì thêm cây đó dựa vào name
        const cropCode = cropName
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\w\s]/gi, "")
          .replace(/\s+/g, "_");

        let finalCropCode = cropCode;
        let counter = 1;
        while (await prisma.crop.findUnique({ where: { cropCode: finalCropCode } })) {
          finalCropCode = `${cropCode}_${counter}`;
          counter++;
        }

        await prisma.crop.create({
          data: {
            name: cropName,
            cropCode: finalCropCode,
            isActive: true,
          },
        });
      }
    }

    // 3. Nếu name nào không có trong cropType của crop-options, is_active là false, đừng xóa
    await prisma.crop.updateMany({
      where: {
        name: { notIn: activeCropNames },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Xóa cache server-side để lần đọc tiếp load lại từ DB
    invalidateCropOptionsCache();

    console.log(
      `[Crop Options Sync] Generated ${options.length} crop(s) from ${records.length} training records → DB`,
    );

    return apiOk({
      message: `Đồng bộ thành công: ${options.length} loại cây trồng từ ${records.length} bản ghi.`,
      crops: options.length,
      totalRecords: records.length,
    });
  } catch (err) {
    console.error("[Crop Options Sync Error]", err);
    return apiError("SYNC_FAILED", 500);
  }
}
