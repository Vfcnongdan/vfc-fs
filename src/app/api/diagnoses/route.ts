import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { DiagnosisStatus, Prisma } from "@prisma/client";
import { cropGrowthStageOptions } from "@/lib/deseaseDetails";
import {
  validateImagesWithGroq,
  runAiDiagnosis,
} from "@/lib/aiDiagnosis";
import { eqStr } from "@/lib/utils";

export const maxDuration = 90;

// POST /api/diagnoses — farmer submits photo for AI diagnosis
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

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
  console.log(`[POST AI Diagnosis] Created ID: ${diagnosis.id} | User: ${user.id} | Crop: ${cropType}`);

  try {
    console.log(`[POST AI Diagnosis] Start validation | ID: ${diagnosis.id} | Crop: ${cropType}`);
    const validationResult = await validateImagesWithGroq(
      base64ImagesSmall,
      cropType ?? undefined
    );

    if (!validationResult.isValid) {
      await prisma.plantDiagnosis.update({
        where: { id: diagnosis.id },
        data: {
          rawAiResponse: validationResult as Prisma.JsonObject,
          summary: validationResult.userGuidance,
          status: DiagnosisStatus.DONE,
        },
      });
      console.log(
        `[POST AI Diagnosis] Validation FAILED | ID: ${diagnosis.id} | reasonCode: ${validationResult.reasonCode} | guidance: ${validationResult.userGuidance}`
      );
      return apiError(validationResult.userGuidance, 400);
    }

    // Danh sách giai đoạn cho loại cây này
    const availableStages =
      cropGrowthStageOptions.find((o) => eqStr(o.cropType, cropType))
        ?.growthStages ?? [];

    console.log(
      `[AI Diagnosis Stage Check] ID: ${diagnosis.id}, Crop: ${cropType}, detectedStage: ${validationResult.detectedGrowthStage}, availableStages: ${availableStages.length}`
    );

    // Luôn yêu cầu xác nhận giai đoạn khi loại cây có danh sách giai đoạn,
    // bất kể AI validation có phát hiện được detectedGrowthStage hay không.
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
          status: DiagnosisStatus.DONE, // dừng polling, client tự xử lý
        },
      });
      console.log(
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

    // Chạy analysis
    console.log(
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
    console.error("[POST AI Diagnosis Error]", err);
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

// GET /api/diagnoses — farmer sees own diagnoses
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

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
