import { Readable } from "stream";
import sharp from "sharp";
import { logger } from "@/lib/logger";
import { normalizeStr } from "@/lib/utils";

export interface ProblematicDiagnosisUploadParams {
  diagnosisId: string;
  cropType?: string;
  growthStage?: string;
  disease?: string;
  confidence?: number;
  caseType: "NO_SOLUTION" | "LOW_CONFIDENCE";
  summary?: string;
  base64Image: string;
}

function escapeXml(unsafe: string): string {
  return (unsafe || "").replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * Ghép banner tóm tắt thông tin ca bệnh vào đáy ảnh bằng sharp.
 */
async function attachDiagnosisBannerToImage(
  imageBuffer: Buffer,
  params: ProblematicDiagnosisUploadParams
): Promise<Buffer> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 600;
    const bannerHeight = 140;

    const isNoSolution = params.caseType === "NO_SOLUTION";
    const badgeText = isNoSolution
      ? "CHƯA CÓ GIẢI PHÁP VFC"
      : `ĐỘ TIN CẬY THẤP: ${Math.round((params.confidence || 0) * 100)}%`;
    const badgeBg = isNoSolution ? "#dc2626" : "#d97706";

    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    const cropText = escapeXml(params.cropType || "Chưa rõ");
    const stageText = escapeXml(params.growthStage || "Chưa rõ");
    const diseaseText = escapeXml(params.disease || "Chưa rõ");
    const idText = escapeXml(params.diagnosisId);
    const summaryText = escapeXml(
      (params.summary || "").slice(0, 95) +
        ((params.summary || "").length > 95 ? "..." : "")
    );

    const svgBanner = `
      <svg width="${width}" height="${bannerHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#0f172a" />
        <rect x="0" y="0" width="100%" height="3" fill="${badgeBg}" />
        
        <!-- Header Badge -->
        <rect x="16" y="14" width="${badgeText.length * 8.5 + 24}" height="22" rx="4" fill="${badgeBg}" />
        <text x="28" y="29" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" fill="#ffffff">${escapeXml(badgeText)}</text>
        
        <text x="${width - 16}" y="29" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#94a3b8">VFC AI Diagnosis System • ${dateStr}</text>

        <!-- Main Info -->
        <text x="16" y="60" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="#f8fafc">
          Cây: <tspan fill="#38bdf8">${cropText}</tspan>  |  Giai đoạn: <tspan fill="#cbd5e1">${stageText}</tspan>  |  Bệnh: <tspan fill="#facc15">${diseaseText}</tspan>
        </text>

        <!-- Summary & ID -->
        <text x="16" y="86" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#cbd5e1">${summaryText}</text>
        <text x="16" y="112" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#64748b">Mã chẩn đoán: ${idText}  •  Vui lòng bổ sung phác đồ hoặc thẩm định</text>
      </svg>
    `;

    const processedImage = await sharp(imageBuffer)
      .extend({
        top: 0,
        left: 0,
        right: 0,
        bottom: bannerHeight,
        background: "#0f172a",
      })
      .composite([
        {
          input: Buffer.from(svgBanner),
          top: metadata.height || 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 88 })
      .toBuffer();

    return processedImage;
  } catch (err) {
    return imageBuffer;
  }
}

function generateFileName(params: ProblematicDiagnosisUploadParams): string {
  const toSlug = (s?: string) =>
    normalizeStr(s || "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown";

  const cleanCrop = toSlug(params.cropType) || "cay";
  const cleanDisease = toSlug(params.disease) || "benh";
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  const shortId = params.diagnosisId.slice(-8);

  if (params.caseType === "NO_SOLUTION") {
    return `[NO_SOLUTION]_[${cleanCrop}]_[${cleanDisease}]_[${dateStr}]_[${shortId}].jpg`;
  } else {
    const confStr = Math.round((params.confidence || 0) * 100);
    return `[LOW_CONF_${confStr}%]_[${cleanCrop}]_[${cleanDisease}]_[${dateStr}]_[${shortId}].jpg`;
  }
}

/**
 * Tự động đồng bộ ca chẩn đoán có vấn đề lên Google Drive qua Google Apps Script Webhook (100% Non-blocking)
 */
export async function uploadProblematicDiagnosisToDrive(
  params: ProblematicDiagnosisUploadParams
): Promise<string | null> {
  const enabled = process.env.ENABLE_GOOGLE_DRIVE_SYNC !== "false";
  if (!enabled) return null;

  const webhookUrl = process.env.GOOGLE_DRIVE_WEBHOOK_URL;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!webhookUrl) {
    logger.info(`[GoogleDriveSync] GOOGLE_DRIVE_WEBHOOK_URL not configured. Skipping ${params.diagnosisId}.`);
    return null;
  }

  try {
    logger.info(
      `[GoogleDriveSync] Uploading to Google Drive via Webhook | ID: ${params.diagnosisId} | Case: ${params.caseType} | Disease: ${params.disease}`
    );

    const cleanBase64 = params.base64Image.replace(/^data:image\/\w+;base64,/, "");
    const rawBuffer = Buffer.from(cleanBase64, "base64");
    const finalBuffer = await attachDiagnosisBannerToImage(rawBuffer, params);
    const fileName = generateFileName(params);

    const description = [
      `=== CA CHẨN ĐOÁN CẦN THẨM ĐỊNH (${params.caseType}) ===`,
      `- Mã chẩn đoán: ${params.diagnosisId}`,
      `- Loại cây: ${params.cropType || "Chưa rõ"}`,
      `- Giai đoạn: ${params.growthStage || "Chưa rõ"}`,
      `- Bệnh nhận diện: ${params.disease || "Chưa rõ"}`,
      `- Độ tin cậy: ${params.confidence ? `${Math.round(params.confidence * 100)}%` : "Chưa rõ"}`,
      `- Lý do: ${params.caseType === "NO_SOLUTION" ? "Không tìm thấy thuốc/phác đồ VFC trong danh mục" : "Độ tin cậy của mô hình < 60%"}`,
      `- Tóm tắt AI: ${params.summary || "N/A"}`,
      `- Thời gian: ${new Date().toISOString()}`,
    ].join("\n");

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderId: folderId || "",
        fileName,
        description,
        base64Image: finalBuffer.toString("base64"),
        diagnosisId: params.diagnosisId,
        caseType: params.caseType,
        cropType: params.cropType,
        disease: params.disease,
        confidence: params.confidence,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned HTTP ${response.status} (${response.statusText})`);
    }

    const data = (await response.json().catch(() => ({}))) as any;
    if (data.status === "success" || data.fileId) {
      logger.info(
        `[GoogleDriveSync] Successfully uploaded! File: ${fileName} | ID: ${data.fileId || "N/A"} | Link: ${data.webViewLink || "N/A"}`
      );
      return data.fileId || "";
    } else {
      logger.warn(`[GoogleDriveSync] Webhook failed for ${params.diagnosisId}: ${data.message || JSON.stringify(data)}`);
      return null;
    }
  } catch (err: any) {
    logger.error(`[GoogleDriveSync] Failed to upload ${params.diagnosisId}: ${err.message}`, err);
    return null;
  }
}
