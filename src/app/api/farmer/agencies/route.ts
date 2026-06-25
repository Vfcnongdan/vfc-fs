import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import type { Agency } from "@prisma/client";
import { filterAgenciesForOrder } from "@/lib/agencyOrderCatalog";
import { prisma } from "@/lib/prisma";
import { AgencyWithDistance, getNearestAgencies } from "@/services/agencyService";

type AgencyRow = Pick<
  Agency,
  | "id"
  | "code"
  | "name"
  | "phone"
  | "taxCode"
  | "salesman"
  | "area"
  | "address"
  | "latitude"
  | "longitude"
  | "wardProvince"
>;

function calculateDistanceMeters(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
) {
  const radiusMeters = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) *
      Math.cos(toRad(latB)) *
      Math.sin(dLon / 2) ** 2;

  return radiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapAgencyToDistance(
  agency: AgencyRow,
  coords?: { lat: number; lon: number },
): AgencyWithDistance {
  const distance = coords
    ? calculateDistanceMeters(coords.lat, coords.lon, agency.latitude, agency.longitude)
    : 0;

  return {
    id: agency.id,
    code: agency.code,
    name: agency.name,
    phone: agency.phone,
    taxCode: agency.taxCode,
    salesman: agency.salesman,
    area: agency.area,
    address: agency.address,
    latitude: agency.latitude,
    longitude: agency.longitude,
    wardProvince: agency.wardProvince,
    distance,
  };
}

async function getFarmerPreferredAgency(
  userId: string,
  coords?: { lat: number; lon: number },
) {
  const farmer = await prisma.farmer.findUnique({
    where: { userId },
    select: { agencyCode: true },
  });

  const agencyCode = farmer?.agencyCode?.trim();
  if (!agencyCode) return null;

  const agency = await prisma.agency.findUnique({
    where: { code: agencyCode },
  });

  if (!agency?.userId) return null;
  return mapAgencyToDistance(agency, coords);
}

async function getAgenciesByWard(ward: string, coords?: { lat: number; lon: number }): Promise<AgencyWithDistance[]> {
  const agencies = await prisma.agency.findMany({
    where: {
      userId: { not: null },
      OR: [
        { wardProvince: { contains: ward, mode: "insensitive" } },
        { address: { contains: ward, mode: "insensitive" } },
      ],
    },
    take: 10,
  });
  return agencies
    .map((a) => mapAgencyToDistance(a, coords))
    .sort((a, b) => a.distance - b.distance);
}

function dedupAndLimit(agencies: AgencyWithDistance[], limit: number): AgencyWithDistance[] {
  const seen = new Set<string>();
  const result: AgencyWithDistance[] = [];
  for (const a of agencies) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    result.push(a);
    if (result.length >= limit) break;
  }
  return result;
}

const MAX_AGENCIES = 5;

export async function GET(request: NextRequest) {
  const headerList = await headers();
  const userId = headerList.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("latitude");
  const lonStr = searchParams.get("longitude");

  const lat = latStr ? parseFloat(latStr) : NaN;
  const lon = lonStr ? parseFloat(lonStr) : NaN;
  const coords = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined;

  const ward = searchParams.get("ward")?.trim() || null;

  try {
    const combined: AgencyWithDistance[] = [];

    // 1. Đại lý ưu tiên (agencyCode của nông dân) → đầu tiên
    const preferred = await getFarmerPreferredAgency(userId, coords);
    if (preferred) {
      combined.push(preferred);
    }

    // 2. Đại lý gần nhất theo GPS
    if (coords) {
      const nearest = await getNearestAgencies(coords.lat, coords.lon);
      const linked = await filterAgenciesForOrder(nearest);
      combined.push(...linked);
    }

    // 3. Nếu chưa đủ 5, bổ sung theo ward/tỉnh
    if (combined.length < MAX_AGENCIES && ward) {
      const wardAgencies = await getAgenciesByWard(ward, coords);
      combined.push(...wardAgencies);
    }

    // 4. Nếu vẫn chưa đủ, lấy thêm đại lý gần nhất (không giới hạn bán kính)
    if (combined.length < MAX_AGENCIES && coords) {
      const fallbackRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM agencies
        WHERE user_id IS NOT NULL AND latitude <> 0 AND longitude <> 0
        ORDER BY earth_distance(ll_to_earth(${coords.lat}, ${coords.lon}), ll_to_earth(latitude, longitude)) ASC
        LIMIT 10
      `;
      if (fallbackRows.length > 0) {
        const fallbackIds = fallbackRows.map((r) => r.id);
        const fallbackAgencies = await prisma.agency.findMany({
          where: { id: { in: fallbackIds } },
        });
        combined.push(
          ...fallbackAgencies.map((a) => mapAgencyToDistance(a, coords)),
        );
      }
    }

    return NextResponse.json(dedupAndLimit(combined, MAX_AGENCIES));
  } catch (error) {
    console.error("[Farmer Agencies GET]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
