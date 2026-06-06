import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAgencyOrderCatalog } from "@/lib/agencyOrderCatalog";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headerList = await headers();
  if (!headerList.get("x-user-id")) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id: agencyId } = await params;
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("suggestionProductIds") ?? "";
  const suggestionProductIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const catalog = await getAgencyOrderCatalog(agencyId, suggestionProductIds);
    if (!catalog) {
      return NextResponse.json({ error: "AGENCY_NOT_AVAILABLE" }, { status: 404 });
    }
    return NextResponse.json(catalog);
  } catch (error) {
    console.error("[Agency Catalog GET]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
