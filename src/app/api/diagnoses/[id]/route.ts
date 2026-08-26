import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { Role, DiagnosisStatus } from "@prisma/client";
import { runAiDiagnosis } from "@/lib/aiDiagnosis";

export const maxDuration = 90;

const MICROSERVICE_URL =
  process.env.DIAGNOSIS_SERVICE_URL || "http://localhost:3001";
const USE_MICROSERVICE =
  process.env.USE_DIAGNOSIS_MICROSERVICE === "true";

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

// ─── Microservice Proxy Handlers ─────────────────────────────────────────────

async function proxyGetDiagnosis(id: string, user: any) {
  try {
    const response = await fetch(`${MICROSERVICE_URL}/api/v1/diagnoses/${id}`, {
      headers: {
        "x-user-id": user.id,
        "x-user-role": user.role,
      },
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();
    return apiOk(data, response.status);
  } catch (err: any) {
    console.error("[Proxy GET Diagnosis Detail Error]", err);
    return apiError(
      `Không thể kết nối đến dịch vụ chẩn đoán AI (${err.message}). Vui lòng thử lại sau.`,
      502
    );
  }
}

async function proxyConfirmStage(request: NextRequest, id: string, user: any) {
  const body = await request.json().catch(() => null);
  if (!body?.growthStage) return apiError("MISSING_GROWTH_STAGE", 400);

  try {
    const response = await fetch(`${MICROSERVICE_URL}/api/v1/diagnoses/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": user.id,
        "x-user-role": user.role,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();
    return apiOk(data, response.status);
  } catch (err: any) {
    console.error("[Proxy PATCH Stage Error]", err);
    return apiError(
      `Không thể kết nối đến dịch vụ chẩn đoán AI (${err.message}). Vui lòng thử lại sau.`,
      502
    );
  }
}

// ─── Legacy Monolith Handlers (Fallback) ──────────────────────────────────────

async function legacyGetDiagnosis(id: string, user: any) {
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

async function legacyConfirmStage(request: NextRequest, id: string, user: any) {
  const body = await request.json().catch(() => null);
  const growthStage = body?.growthStage as string | undefined;

  if (!growthStage) return apiError("MISSING_GROWTH_STAGE", 400);

  const diagnosis = await prisma.plantDiagnosis.findUnique({
    where: { id },
  });

  if (!diagnosis) return apiError("NOT_FOUND", 404);
  if (diagnosis.userId !== user.id) return apiError("FORBIDDEN", 403);

  const awaitingPayload = diagnosis.rawAiResponse;
  if (!isAwaitingStagePayload(awaitingPayload)) {
    console.log(`[PATCH AI Diagnosis] INVALID_STATE | ID: ${id} | rawAiResponse: ${JSON.stringify(awaitingPayload)}`);
    return apiError("INVALID_STATE", 400);
  }

  await prisma.plantDiagnosis.update({
    where: { id },
    data: {
      status: DiagnosisStatus.PROCESSING,
      rawAiResponse: { processingStage: growthStage },
    },
  });
  console.log(`[PATCH AI Diagnosis] Start stage-confirmed diagnosis | ID: ${id} | Stage: ${growthStage}`);

  const base64Images = body?.base64Images as string[] | undefined;
  if (!base64Images?.length) {
    return apiError("MISSING_IMAGES", 400);
  }

  try {
    console.log(
      `[PATCH AI Diagnosis] Start AI diagnosis | ID: ${id} | Crop: ${diagnosis.cropType} | Stage: ${growthStage} | Pest: ${awaitingPayload.detectedPestDisease ?? "any"} | Severity: ${awaitingPayload.detectedSeverityLevel ?? "any"}`
    );
    await runAiDiagnosis(
      id,
      base64Images,
      diagnosis.cropType ?? undefined,
      growthStage,
      awaitingPayload.detectedPestDisease ?? undefined,
      awaitingPayload.detectedSeverityLevel ?? undefined
    );
  } catch (err) {
    console.error(`[PATCH AI Diagnosis Error] | ID: ${id}`, err);
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

// ─── Main Route Handlers ──────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { id } = await params;

  if (USE_MICROSERVICE) {
    return proxyGetDiagnosis(id, user);
  }
  return legacyGetDiagnosis(id, user);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { id } = await params;

  if (USE_MICROSERVICE) {
    return proxyConfirmStage(request, id, user);
  }
  return legacyConfirmStage(request, id, user);
}
