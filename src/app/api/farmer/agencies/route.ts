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

type AgencyDistanceRow = Omit<AgencyRow, "taxCode" | "wardProvince"> & {
  tax_code: string | null;
  ward_province: string | null;
  distance: number | { toString(): string };
};

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

function mapDistanceRow(row: AgencyDistanceRow): AgencyWithDistance {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    taxCode: row.tax_code,
    salesman: row.salesman,
    area: row.area,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    wardProvince: row.ward_province,
    distance: Number(row.distance),
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

async function filterSellingAgencies(agencies: AgencyWithDistance[]) {
  if (agencies.length === 0) return [];

  const agencyRows = await prisma.agency.findMany({
    where: {
      id: { in: agencies.map((agency) => agency.id) },
      userId: { not: null },
    },
    select: { id: true },
  });

  const sellingAgencyIds = new Set(agencyRows.map((agency) => agency.id));
  return agencies.filter((agency) => sellingAgencyIds.has(agency.id));
}

async function getFallbackSellingAgencies(coords?: { lat: number; lon: number }) {
  if (coords) {
    const rows = await prisma.$queryRaw<AgencyDistanceRow[]>`
      SELECT id, code, name, phone, address, latitude, longitude, tax_code, salesman, area, ward_province,
        earth_distance(ll_to_earth(${coords.lat}, ${coords.lon}), ll_to_earth(latitude, longitude)) as distance
      FROM agencies
      WHERE user_id IS NOT NULL AND latitude <> 0 AND longitude <> 0
      ORDER BY distance ASC
      LIMIT 5
    `;

    if (rows.length > 0) return rows.map(mapDistanceRow);
  }

  const sellingAgencies = await prisma.agency.findMany({
    where: { userId: { not: null } },
    orderBy: { name: "asc" },
    take: 5,
  });

  if (sellingAgencies.length > 0) {
    return sellingAgencies.map((agency) => mapAgencyToDistance(agency, coords));
  }

  const anyAgencies = await prisma.agency.findMany({
    orderBy: { name: "asc" },
    take: 5,
  });

  return anyAgencies.map((agency) => mapAgencyToDistance(agency, coords));
}

async function getAgenciesByWard(ward: string): Promise<AgencyWithDistance[]> {
  const agencies = await prisma.agency.findMany({
    where: {
      userId: { not: null },
      OR: [
        { wardProvince: { contains: ward, mode: "insensitive" } },
        { address: { contains: ward, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: 5,
  });
  return agencies.map((a) => mapAgencyToDistance(a));
}


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

  const rawIds = searchParams.get("suggestionProductIds") ?? "";
  const suggestionProductIds = rawIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ward = searchParams.get("ward")?.trim() || null;


  try {
    const preferredAgency = await getFarmerPreferredAgency(userId, coords);
    if (preferredAgency) {
      return NextResponse.json([preferredAgency]);
    }

    const nearest = coords ? await getNearestAgencies(coords.lat, coords.lon) : [];
    const stockedNearest =
      suggestionProductIds.length > 0
        ? await filterAgenciesForOrder(nearest, suggestionProductIds)
        : await filterSellingAgencies(nearest);

    if (stockedNearest.length > 0) {
      return NextResponse.json(stockedNearest);
    }

    const sellingNearest = await filterSellingAgencies(nearest);
    if (sellingNearest.length > 0) {
      return NextResponse.json(sellingNearest);
    }

    // Fallback theo xã của user (không có GPS)
    if (ward) {
      const wardAgencies = await getAgenciesByWard(ward);
      if (wardAgencies.length > 0) {
        return NextResponse.json(wardAgencies);
      }
    }

    const fallbackAgencies = await getFallbackSellingAgencies(coords);
    return NextResponse.json(fallbackAgencies);
  } catch (error) {
    console.error("[Farmer Agencies GET]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
