import { NextResponse } from "next/server";
import { getCropOptions } from "@/lib/cropOptions";

export async function GET() {
  try {
    const options = await getCropOptions();
    return NextResponse.json(options);
  } catch (err) {
    console.error("[Crop Options GET]", err);
    return NextResponse.json([], { status: 500 });
  }
}
