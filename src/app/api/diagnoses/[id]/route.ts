import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { Role, DiagnosisStatus } from "@prisma/client";
import { runAiDiagnosis } from "@/lib/aiDiagnosis";

export const maxDuration = 90;

function isAwaitingStagePayload(
  value: unknown
): value is {
  awaitingStage: true;
  detectedPestDisease?: string | null;
  detectedSeverityLevel?: string | null;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "awaitingStage" in value &&
    value.awaitingStage === true
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { id } = await params;
  const diagnosis = await prisma.plantDiagnosis.findUnique({
    where: { id },
    include: {
      suggestions: {
        include: {
          product: {
            select: { id: true, name: true, imageUrls: true, slug: true },
          },
        },
        orderBy: { rank: "asc" },
      },
    },
  });

  if (!diagnosis) return apiError("NOT_FOUND", 404);
  if (user.role === Role.FARMER && diagnosis.userId !== user.id)
    return apiError("FORBIDDEN", 403);

  return apiOk(diagnosis);
}

/**
 * PATCH /api/diagnoses/:id
 * body: { growthStage: string }
 * Trigger AI analysis sau khi user chọn giai đoạn thủ công.
 * Chỉ hợp lệ khi diagnosis đang ở trạng thái AWAITING_STAGE (rawAiResponse.awaitingStage = true).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const growthStage = body?.growthStage as string | undefined;

  if (!growthStage) return apiError("MISSING_GROWTH_STAGE", 400);

  const diagnosis = await prisma.plantDiagnosis.findUnique({
    where: { id },
  });

  if (!diagnosis) return apiError("NOT_FOUND", 404);
  if (diagnosis.userId !== user.id) return apiError("FORBIDDEN", 403);

  // Kiểm tra trạng thái hợp lệ
  const awaitingPayload = diagnosis.rawAiResponse;
  if (!isAwaitingStagePayload(awaitingPayload)) {
    return apiError("INVALID_STATE", 400);
  }

  // Reset về PROCESSING để client poll
  await prisma.plantDiagnosis.update({
    where: { id },
    data: {
      status: DiagnosisStatus.PROCESSING,
      rawAiResponse: { processingStage: growthStage },
    },
  });

  // Lấy lại base64 images — không lưu ảnh nên cần client gửi lại?
  // Không thể: ảnh không được lưu. Phải yêu cầu client re-upload.
  // Giải pháp: client gửi base64 ảnh cùng với PATCH request.
  const base64Images = body?.base64Images as string[] | undefined;
  if (!base64Images?.length) {
    return apiError("MISSING_IMAGES", 400);
  }

  try {
    await runAiDiagnosis(
      id,
      base64Images,
      diagnosis.cropType ?? undefined,
      growthStage,
      awaitingPayload.detectedPestDisease ?? undefined,
      awaitingPayload.detectedSeverityLevel ?? undefined
    );
  } catch (err) {
    console.error("[PATCH AI Diagnosis Error]", err);
    await prisma.plantDiagnosis.update({
      where: { id },
      data: { status: DiagnosisStatus.FAILED },
    });
  }

  const updated = await prisma.plantDiagnosis.findUnique({
    where: { id },
    include: {
      suggestions: {
        include: {
          product: {
            select: { id: true, name: true, imageUrls: true, slug: true },
          },
        },
        orderBy: { rank: "asc" },
      },
    },
  });

  return apiOk(updated || { id, status: "PROCESSING" });
}
