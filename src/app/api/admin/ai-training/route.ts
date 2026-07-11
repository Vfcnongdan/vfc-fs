import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", 401);
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 20;

  const cropType = searchParams.get("cropType") || undefined;
  const growthStages = searchParams.getAll("growthStage").filter(Boolean);
  const pestDiseases = searchParams.getAll("pestDisease").filter(Boolean);
  const severityLevels = searchParams.getAll("severityLevel").filter(Boolean);

  // Tim kiem bat buoc phai co ten cay
  if (!cropType) {
    return apiOk({ data: [], total: 0, totalPages: 0, page, limit });
  }

  const where: any = {
    cropType: { equals: cropType, mode: "insensitive" },
  };

  if (growthStages.length > 0) {
    where.growthStage = { in: growthStages, mode: "insensitive" };
  }
  if (pestDiseases.length > 0) {
    where.pestDisease = { in: pestDiseases, mode: "insensitive" };
  }
  if (severityLevels.length > 0) {
    where.severityLevel = { in: severityLevels, mode: "insensitive" };
  }

  const [total, data] = await Promise.all([
    prisma.planStageDisease.count({ where }),
    prisma.planStageDisease.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return apiOk({
    data,
    total,
    totalPages: Math.ceil(total / limit),
    page,
    limit,
  });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", 401);
  }

  const body = await request.json().catch(() => null);
  if (!body) return apiError("INVALID_BODY", 400);

  const {
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
  } = body;

  if (!cropType || !growthStage || !pestDisease || !severityLevel || !detail) {
    return apiError("Thiếu thông tin bắt buộc", 400);
  }

  try {
    const record = await prisma.planStageDisease.create({
      data: {
        cropType,
        growthStage,
        pestDisease,
        detail,
        severityLevel,
        imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
        description: description || "",
        vfcSolution: vfcSolution || "",
        actionThreshold: actionThreshold || "",
        pestDensity: pestDensity || "",
      },
    });

    return apiOk(record);
  } catch (error) {
    console.error("CREATE_AI_TRAINING_ERROR:", error);
    return apiError("Không thể tạo dữ liệu", 500);
  }
}
