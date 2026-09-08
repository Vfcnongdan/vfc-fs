import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { DiagnosisStatus, Prisma } from "@prisma/client";
import { getCropOptionByType } from "@/lib/cropOptions";
import {
  validateImagesWithGroq,
  runAiDiagnosis,
} from "@/lib/aiDiagnosis";
import { logger } from "@/lib/logger";

export const maxDuration = 90;

const MICROSERVICE_URL =
  process.env.DIAGNOSIS_SERVICE_URL || "http://localhost:3001";
const USE_MICROSERVICE =
  process.env.USE_DIAGNOSIS_MICROSERVICE === "true";

// ─── Microservice Proxy Handlers ─────────────────────────────────────────────

async function proxyCreateDiagnosis(request: NextRequest, user: any) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return apiError("INVALID_FORM_DATA", 400);

  const cropType = (formData.get("cropType") as string) || undefined;
  const files = formData.getAll("images") as File[];
  if (!files.length) return apiError("NO_IMAGES", 400);

  const base64Images: string[] = [];
  const base64ImagesSmall: string[] = [];
  const sharp = (await import("sharp")).default;

  for (const file of files) {
    let buffer: Buffer | null = Buffer.from(await file.arrayBuffer());

    const optimizedBuffer = await sharp(buffer)
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    base64Images.push(optimizedBuffer.toString("base64"));

    const smallBuffer = await sharp(buffer)
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 40 })
      .toBuffer();
    base64ImagesSmall.push(smallBuffer.toString("base64"));

    buffer = null;
  }

  logger.info(
    `[Proxy POST Diagnosis] Sending to ${MICROSERVICE_URL}/api/v1/diagnoses | User: ${user.id} | Crop: ${cropType}`
  );

  try {
    const response = await fetch(`${MICROSERVICE_URL}/api/v1/diagnoses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": user.id,
        "x-user-role": user.role,
      },
      body: JSON.stringify({
        base64Images,
        base64ImagesSmall,
        cropType,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();
    return apiOk(data, response.status);
  } catch (err: any) {
    logger.error("[Proxy POST Diagnosis Error]", err);
    return apiError(
      `Không thể kết nối đến dịch vụ chẩn đoán AI (${err.message}). Vui lòng thử lại sau.`,
      502
    );
  }
}

async function proxyListDiagnoses(request: NextRequest, user: any) {
  try {
    const response = await fetch(
      `${MICROSERVICE_URL}/api/v1/diagnoses?${request.nextUrl.searchParams}`,
      {
        headers: {
          "x-user-id": user.id,
          "x-user-role": user.role,
        },
        signal: AbortSignal.timeout(60000),
      }
    );

    const data = await response.json();
    return apiOk(data, response.status);
  } catch (err: any) {
    logger.error("[Proxy GET Diagnoses Error]", err);
    return apiError(
      "Không thể kết nối đến dịch vụ chẩn đoán AI. Vui lòng thử lại sau.",
      502
    );
  }
}

// ─── Legacy Monolith Handlers (Fallback) ──────────────────────────────────────

async function legacyCreateDiagnosis(request: NextRequest, user: any) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return apiError("INVALID_FORM_DATA", 400);

  const cropType = formData.get("cropType") as string | null;
  const growthStage = formData.get("growthStage") as string | null;
  const files = formData.getAll("images") as File[];
  if (!files.length) return apiError("NO_IMAGES", 400);

  const base64Images: string[] = [];
  const base64ImagesSmall: string[] = [];
  const sharp = (await import("sharp")).default;

  for (const file of files) {
    let buffer: Buffer | null = Buffer.from(await file.arrayBuffer());

    const optimizedBuffer = await sharp(buffer)
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    base64Images.push(optimizedBuffer.toString("base64"));

    const smallBuffer = await sharp(buffer)
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 40 })
      .toBuffer();
    base64ImagesSmall.push(smallBuffer.toString("base64"));

    buffer = null;
  }

  const diagnosis = await prisma.plantDiagnosis.create({
    data: {
      userId: user.id,
      cropType,
      imageUrls: [],
      status: DiagnosisStatus.PROCESSING,
    },
  });
  logger.info(`[POST AI Diagnosis] Created ID: ${diagnosis.id} | User: ${user.id} | Crop: ${cropType}`);

  try {
    logger.info(`[POST AI Diagnosis] Start validation | ID: ${diagnosis.id} | Crop: ${cropType}`);
    const validationResult = await validateImagesWithGroq(
      base64ImagesSmall,
      cropType ?? undefined
    );

    if (!validationResult.isValid) {
      if (validationResult.reasonCode === "WRONG_CROP") {
        const wrongCropSummary = validationResult.plantInfo
          ? `Thông tin dịch hại trên cây trồng bạn đưa không chính xác. Đây là một số thông tin hữu ích về cây này:\n${validationResult.plantInfo}\n\nĐể được hỗ trợ hiệu quả từ VFC xin cung cấp thông tin và hình ảnh chính xác.`
          : validationResult.userGuidance;

        await prisma.plantDiagnosis.update({
          where: { id: diagnosis.id },
          data: {
            rawAiResponse: validationResult as Prisma.JsonObject,
            summary: wrongCropSummary,
            status: DiagnosisStatus.DONE,
          },
        });
        logger.info(
          `[POST AI Diagnosis] WRONG_CROP | ID: ${diagnosis.id} | plantInfo: ${validationResult.plantInfo?.slice(0, 100) ?? "null"}`
        );
        return apiOk({
          id: diagnosis.id,
          status: "DONE",
          wrongCrop: true,
          summary: wrongCropSummary,
          plantInfo: validationResult.plantInfo,
        });
      }

      await prisma.plantDiagnosis.update({
        where: { id: diagnosis.id },
        data: {
          rawAiResponse: validationResult as Prisma.JsonObject,
          summary: validationResult.userGuidance,
          status: DiagnosisStatus.FAILED,
        },
      });
      logger.info(
        `[POST AI Diagnosis] Validation FAILED | ID: ${diagnosis.id} | reasonCode: ${validationResult.reasonCode} | guidance: ${validationResult.userGuidance}`
      );
      return apiError(validationResult.userGuidance, 400);
    }

    const cropOption = await getCropOptionByType(cropType ?? undefined);
    const availableStages = cropOption?.growthStages ?? [];

    logger.info(
      `[AI Diagnosis Stage Check] ID: ${diagnosis.id}, Crop: ${cropType}, detectedStage: ${validationResult.detectedGrowthStage}, availableStages: ${availableStages.length}`
    );

    if (availableStages.length > 0) {
      const awaitingPayload = {
        awaitingStage: true,
        availableStages,
        detectedGrowthStage: validationResult.detectedGrowthStage,
        detectedPestDisease: validationResult.detectedPestDisease,
        detectedSeverityLevel: validationResult.detectedSeverityLevel,
      };
      await prisma.plantDiagnosis.update({
        where: { id: diagnosis.id },
        data: {
          rawAiResponse: awaitingPayload,
          status: DiagnosisStatus.DONE,
        },
      });
      logger.info(
        `[POST AI Diagnosis] AWAITING_STAGE | ID: ${diagnosis.id} | Stages: ${availableStages.length} | Detected: ${validationResult.detectedGrowthStage} | Pest: ${validationResult.detectedPestDisease} | Severity: ${validationResult.detectedSeverityLevel}`
      );
      return apiOk({
        id: diagnosis.id,
        status: "AWAITING_STAGE",
        awaitingStage: true,
        availableStages,
        detectedGrowthStage: validationResult.detectedGrowthStage,
      });
    }

    logger.info(
      `[POST AI Diagnosis] Start AI diagnosis | ID: ${diagnosis.id} | Crop: ${cropType} | Stage: ${growthStage ?? validationResult.detectedGrowthStage ?? "any"} | Pest: ${validationResult.detectedPestDisease ?? "any"} | Severity: ${validationResult.detectedSeverityLevel ?? "any"}`
    );
    await runAiDiagnosis(
      diagnosis.id,
      base64Images,
      cropType ?? undefined,
      growthStage ?? validationResult.detectedGrowthStage ?? undefined,
      validationResult.detectedPestDisease ?? undefined,
      validationResult.detectedSeverityLevel ?? undefined
    );
  } catch (err) {
    logger.error("[POST AI Diagnosis Error]", err);
    await prisma.plantDiagnosis.update({
      where: { id: diagnosis.id },
      data: { status: DiagnosisStatus.FAILED },
    });
  }

  const updatedDiagnosis = await prisma.plantDiagnosis.findUnique({
    where: { id: diagnosis.id },
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

  return apiOk(updatedDiagnosis || { id: diagnosis.id, status: "PROCESSING" }, 200);
}

async function legacyListDiagnoses(request: NextRequest, user: any) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 10;

  const [total, diagnoses] = await Promise.all([
    prisma.plantDiagnosis.count({ where: { userId: user.id } }),
    prisma.plantDiagnosis.findMany({
      where: { userId: user.id },
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return apiOk({ data: diagnoses, total, page, limit });
}

// ─── Main Route Handlers ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  if (USE_MICROSERVICE) {
    return proxyCreateDiagnosis(request, user);
  }
  return legacyCreateDiagnosis(request, user);
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  if (USE_MICROSERVICE) {
    return proxyListDiagnoses(request, user);
  }
  return legacyListDiagnoses(request, user);
}
