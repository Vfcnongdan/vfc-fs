import { NextRequest } from "next/server";
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";

export const runtime = "nodejs";

type ImportRow = {
  cropType: string;
  growthStage: string;
  pestDisease: string;
  detail: string;
  severityLevel: string;
  imageUrls: string[];
  description: string;
  vfcSolution: string;
  actionThreshold: string;
  pestDensity: string;
};

// Khóa tự nhiên để nhận diện bản ghi trùng lặp
function naturalKey(r: {
  cropType: string;
  growthStage: string;
  pestDisease: string;
  detail: string;
  severityLevel: string;
}) {
  return [r.cropType, r.growthStage, r.pestDisease, r.detail, r.severityLevel]
    .map((v) => (v || "").trim().toLowerCase())
    .join("||");
}

function splitUrls(raw: string): string[] {
  return (raw || "")
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", 401);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return apiError("INVALID_BODY", 400);

  const file = formData.get("file");
  const mode = String(formData.get("mode") || "skip"); // "override" | "skip"

  if (!(file instanceof File)) {
    return apiError("Vui lòng chọn tệp CSV", 400);
  }
  if (mode !== "override" && mode !== "skip") {
    return apiError("Chế độ import không hợp lệ", 400);
  }

  let records: string[][];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    records = parse(buffer, {
      columns: false,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (error) {
    console.error("IMPORT_CSV_PARSE_ERROR:", error);
    return apiError("Không thể đọc tệp CSV. Vui lòng kiểm tra định dạng.", 400);
  }

  if (records.length < 2) {
    return apiError("Tệp CSV không có dữ liệu", 400);
  }

  // Bỏ dòng tiêu đề
  const dataRows = records.slice(1);

  const parsed: ImportRow[] = [];
  let skippedInvalid = 0;

  for (const row of dataRows) {
    const cropType = (row[0] || "").trim();
    const growthStage = (row[1] || "").trim();
    const pestDisease = (row[2] || "").trim();
    const detail = (row[3] || "").trim();
    const severityLevel = (row[4] || "").trim();

    // Bỏ qua các dòng thiếu trường bắt buộc
    if (!cropType || !growthStage || !pestDisease || !detail || !severityLevel) {
      skippedInvalid++;
      continue;
    }

    parsed.push({
      cropType,
      growthStage,
      pestDisease,
      detail,
      severityLevel,
      imageUrls: splitUrls(row[5] || ""),
      description: (row[6] || "").trim(),
      vfcSolution: (row[7] || "").trim(),
      actionThreshold: (row[8] || "").trim(),
      pestDensity: (row[9] || "").trim(),
    });
  }

  if (parsed.length === 0) {
    return apiError("Không có dòng dữ liệu hợp lệ để import", 400);
  }

  try {
    if (mode === "override") {
      // Xóa toàn bộ dữ liệu cũ và nạp lại (vẫn loại trùng trong chính file)
      const seen = new Set<string>();
      const unique: ImportRow[] = [];
      let dupInFile = 0;
      for (const r of parsed) {
        const key = naturalKey(r);
        if (seen.has(key)) {
          dupInFile++;
          continue;
        }
        seen.add(key);
        unique.push(r);
      }

      const result = await prisma.$transaction(async (tx) => {
        const deleted = await tx.planStageDisease.deleteMany({});
        const created = await tx.planStageDisease.createMany({ data: unique });
        return { deleted: deleted.count, created: created.count };
      });

      return apiOk({
        mode,
        totalRows: parsed.length,
        deleted: result.deleted,
        inserted: result.created,
        skippedInvalid,
        skippedDuplicateInFile: dupInFile,
        skippedExisting: 0,
      });
    }

    // mode === "skip": chỉ thêm bản ghi chưa tồn tại (loại trùng với DB và trong file)
    const existing = await prisma.planStageDisease.findMany({
      select: {
        cropType: true,
        growthStage: true,
        pestDisease: true,
        detail: true,
        severityLevel: true,
      },
    });
    const existingKeys = new Set(existing.map((e) => naturalKey(e)));

    const seen = new Set<string>();
    const toInsert: ImportRow[] = [];
    let dupInFile = 0;
    let dupExisting = 0;

    for (const r of parsed) {
      const key = naturalKey(r);
      if (existingKeys.has(key)) {
        dupExisting++;
        continue;
      }
      if (seen.has(key)) {
        dupInFile++;
        continue;
      }
      seen.add(key);
      toInsert.push(r);
    }

    const created =
      toInsert.length > 0
        ? await prisma.planStageDisease.createMany({ data: toInsert })
        : { count: 0 };

    return apiOk({
      mode,
      totalRows: parsed.length,
      deleted: 0,
      inserted: created.count,
      skippedInvalid,
      skippedDuplicateInFile: dupInFile,
      skippedExisting: dupExisting,
    });
  } catch (error) {
    console.error("IMPORT_AI_TRAINING_ERROR:", error);
    return apiError("Không thể import dữ liệu", 500);
  }
}
