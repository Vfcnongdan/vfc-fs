import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getNearestAgencies } from "@/services/agencyService";

export async function GET(request: NextRequest) {
  const headerList = await headers();
  const userId = headerList.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("latitude");
  const lonStr = searchParams.get("longitude");

  if (!latStr || !lonStr) {
    return NextResponse.json({ error: "MISSING_COORDINATES" }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "INVALID_COORDINATES" }, { status: 400 });
  }

  try {
    const agencies = await getNearestAgencies(lat, lon);
    return NextResponse.json(agencies);
  } catch (error) {
    console.error("[Farmer Agencies GET]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
