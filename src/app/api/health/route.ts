import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "connected";

  try {
    // Kiểm tra kết nối Database Neon / Postgres với query tối giản
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = "disconnected";
    return NextResponse.json(
      {
        status: "error",
        service: "vfc-fs",
        database: dbStatus,
        error: err?.message || "Database connection failed",
        responseTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      service: "vfc-fs",
      database: dbStatus,
      responseTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
