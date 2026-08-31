import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError } from "@/lib/request";

export const runtime = "nodejs";

function escapeCsvField(field: string | null | undefined): string {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  // Thay thế ký tự nháy kép bằng 2 nháy kép và bao quanh bởi nháy kép
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const cropType = searchParams.get("cropType");

    const where: any = {};
    if (cropType) {
      where.cropType = cropType;
    }

    const records = await prisma.planStageDisease.findMany({
      where,
      orderBy: [
        { cropType: "asc" },
        { growthStage: "asc" },
        { pestDisease: "asc" },
        { detail: "asc" },
        { severityLevel: "asc" },
      ],
    });

    const headers = [
      "id",
      "crop_type",
      "growth_stage",
      "pest_disease",
      "detail",
      "severity_level",
      "image_urls",
      "description",
      "vfc_solution",
      "action_threshold",
      "pest_density",
      "created_at",
      "updated_at",
    ];

    const csvRows: string[] = [headers.map((h) => `"${h}"`).join(",")];

    for (const r of records) {
      const row = [
        escapeCsvField(r.id),
        escapeCsvField(r.cropType),
        escapeCsvField(r.growthStage),
        escapeCsvField(r.pestDisease),
        escapeCsvField(r.detail),
        escapeCsvField(r.severityLevel),
        escapeCsvField(JSON.stringify(r.imageUrls)),
        escapeCsvField(r.description),
        escapeCsvField(r.vfcSolution),
        escapeCsvField(r.actionThreshold),
        escapeCsvField(r.pestDensity),
        escapeCsvField(r.createdAt.toISOString()),
        escapeCsvField(r.updatedAt.toISOString()),
      ];
      csvRows.push(row.join(","));
    }

    // Thêm UTF-8 BOM (\uFEFF) để Excel hiển thị đúng tiếng Việt
    const csvContent = "\uFEFF" + csvRows.join("\r\n");

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const filename = cropType
      ? `plan_stage_diseases_${cropType}_${dateStr}.csv`
      : `plan_stage_diseases_${dateStr}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("[Export CSV Error]", error);
    return apiError("EXPORT_FAILED", 500);
  }
}
