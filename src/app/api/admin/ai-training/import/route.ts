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

// Khóa tự nhiên để nhận diện bản ghi trùng lặp (bao gồm cả danh sách hình ảnh)
function naturalKey(r: {
  cropType: string;
  growthStage: string;
  pestDisease: string;
  detail: string;
  severityLevel: string;
  imageUrls?: string[];
}) {
  const normUrls = (r.imageUrls || [])
    .map((u) => (u || "").trim().toLowerCase().replace(/\/+$/, ""))
    .filter(Boolean)
    .sort()
    .join("##");

  return [r.cropType, r.growthStage, r.pestDisease, r.detail, r.severityLevel, normUrls]
    .map((v) => (v || "").trim().toLowerCase())
    .join("||");
}

function cleanSeverity(raw: string): string {
  return (raw || "")
    .trim()
    .replace(/^\["?|"?\]$/g, "")
    .replace(/^"|"$/g, "")
    .trim();
}

function splitUrls(raw: string): string[] {
  // Xử lý mọi dạng serialization phổ biến:
  // - Postgres array: {"url1","url2"} hoặc {url1,url2}
  // - JSON array:     ["url1","url2"]
  // - Plain text:     url1\nurl2 hoặc url1,url2
  return (raw || "")
    .trim()
    .replace(/^\{|\}$|^\[|\]$/g, "")
    .split(/[\n,]+/)
    .map((u) => u.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, ""))
    .filter(Boolean);
}

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
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

  // Phân tích Header row để tìm vị trí các cột
  const headerRow = records[0].map((h) => normalizeStr(String(h)));
  let mapCrop = -1;
  let mapStage = -1;
  let mapPest = -1;
  let mapDetail = -1;
  let mapSeverity = -1;
  let mapImages = -1;
  let mapDesc = -1;
  let mapSolution = -1;
  let mapThreshold = -1;
  let mapDensity = -1;

  headerRow.forEach((col, idx) => {
    if (col === "croptype" || col === "crop" || col === "caytrong" || col === "tencay" || col === "loaicay") mapCrop = idx;
    else if (col === "growthstage" || col === "stage" || col === "giaidoan" || col === "giaidoansinhtruong") mapStage = idx;
    else if (col === "pestdisease" || col === "loaidichhai" || col === "dichhai" || col === "pest" || col === "disease") mapPest = idx;
    else if (col === "detail" || col === "tensaubenh" || col === "tendichhai" || col === "chitiet") mapDetail = idx;
    else if (col === "severitylevel" || col === "severity" || col === "mucdo" || col === "mucdonghiemtrong") mapSeverity = idx;
    else if (col === "imageurls" || col === "imageurl" || col === "hinhanh" || col === "anh" || col === "urls") mapImages = idx;
    else if (col === "description" || col === "mota" || col === "trieuchung") mapDesc = idx;
    else if (col === "vfcsolution" || col === "solution" || col === "giaiphap" || col === "giaiphapvfc" || col === "thuoc") mapSolution = idx;
    else if (col === "actionthreshold" || col === "threshold" || col === "nguong" || col === "nguonghanhdong") mapThreshold = idx;
    else if (col === "pestdensity" || col === "density" || col === "matdo" || col === "matdosau") mapDensity = idx;
  });

  const hasMappedHeaders = mapCrop !== -1 && mapStage !== -1 && mapPest !== -1 && mapDetail !== -1 && mapSeverity !== -1;

  // Bỏ dòng tiêu đề
  const dataRows = records.slice(1);
  const parsed: ImportRow[] = [];
  let skippedInvalid = 0;

  for (const row of dataRows) {
    let cropType = "";
    let growthStage = "";
    let pestDisease = "";
    let detail = "";
    let severityLevel = "";
    let imageUrls: string[] = [];
    let description = "";
    let vfcSolution = "";
    let actionThreshold = "";
    let pestDensity = "";

    if (hasMappedHeaders) {
      cropType = (row[mapCrop] || "").trim();
      growthStage = (row[mapStage] || "").trim();
      pestDisease = (row[mapPest] || "").trim();
      detail = (row[mapDetail] || "").trim();
      severityLevel = cleanSeverity(row[mapSeverity] || "");
      imageUrls = mapImages !== -1 ? splitUrls(row[mapImages] || "") : [];
      description = mapDesc !== -1 ? (row[mapDesc] || "").trim() : "";
      vfcSolution = mapSolution !== -1 ? (row[mapSolution] || "").trim() : "";
      actionThreshold = mapThreshold !== -1 ? (row[mapThreshold] || "").trim() : "";
      pestDensity = mapDensity !== -1 ? (row[mapDensity] || "").trim() : "";
    } else {
      // Fallback: Tự động phát hiện vị trí cột dựa trên dạng dữ liệu
      let offset = 0;
      // Nếu cột 0 là CUID / ID
      if (row[0] && (row[0].length >= 24 || row[0].startsWith("c") || row[0].includes("-"))) {
        offset = 1;
      }
      // Nếu cột tiếp theo là Số Thứ Tự (STT) nguyên số (1, 2, 3...)
      if (/^\d+$/.test((row[offset] || "").trim())) {
        offset += 1;
      }

      cropType = (row[offset] || "").trim();
      growthStage = (row[offset + 1] || "").trim();
      pestDisease = (row[offset + 2] || "").trim();
      detail = (row[offset + 3] || "").trim();
      severityLevel = cleanSeverity(row[offset + 4] || "");
      imageUrls = splitUrls(row[offset + 5] || "");
      description = (row[offset + 6] || "").trim();
      vfcSolution = (row[offset + 7] || "").trim();
      actionThreshold = (row[offset + 8] || "").trim();
      pestDensity = (row[offset + 9] || "").trim();
    }

    // Kiểm tra tính hợp lệ: Bắt buộc không được để trống và cropType không thể là số hoặc ID
    if (
      !cropType ||
      /^\d+$/.test(cropType) ||
      cropType.length >= 24 ||
      !growthStage ||
      !pestDisease ||
      !detail ||
      !severityLevel
    ) {
      skippedInvalid++;
      continue;
    }

    parsed.push({
      cropType,
      growthStage,
      pestDisease,
      detail,
      severityLevel,
      imageUrls,
      description,
      vfcSolution,
      actionThreshold,
      pestDensity,
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
        imageUrls: true,
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
