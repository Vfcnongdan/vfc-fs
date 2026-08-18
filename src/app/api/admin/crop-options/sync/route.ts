import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { invalidateCropOptionsCache } from "@/lib/cropOptions";
import type { CropGrowthStageOptions } from "@/lib/deseaseDetails";

const OUTPUT_PATH = path.join(process.cwd(), "public", "crop-options.json");

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

    // Ghi file ra public/
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(options, null, 2), "utf-8");

    // Xóa cache server-side để lần đọc tiếp load file mới
    invalidateCropOptionsCache();

    console.log(
      `[Crop Options Sync] Generated ${options.length} crop(s) from ${records.length} training records → ${OUTPUT_PATH}`,
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
