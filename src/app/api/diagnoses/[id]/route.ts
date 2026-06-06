import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { Role } from "@prisma/client";

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
          product: { select: { id: true, name: true, imageUrls: true, slug: true, price: true } },
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
