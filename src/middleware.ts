import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME, Role } from "@/lib/auth";
import { logger } from "@/lib/logger";

// Route protection config
const PUBLIC_PATHS = [
  "/",
  "/assets",
  "/api/health",
  "/api/auth/otp/send",
  "/api/auth/otp/verify",
  "/api/auth/zalo/callback",
  "/zalo_verifierOyIX99Bk6tXmqSnrjELRVNV3wrIRjJ4FCpap.html",
];
const ROLE_PATHS: Record<string, Role[]> = {
  "/api/admin": [Role.ADMIN],
  "/admin/orders": [Role.ADMIN, Role.AGENCY, Role.SUPER_AGENT, Role.MDO, Role.SE, Role.MDM, Role.CV_CM, Role.ASM, Role.TSM],
  "/admin/products": [Role.ADMIN],
  "/admin/system": [Role.ADMIN],
  "/sale": [Role.SALE, Role.ADMIN],
  "/api/sale": [Role.SALE, Role.ADMIN],
  "/agent": [Role.SUPER_AGENT, Role.AGENCY, Role.ADMIN],
  "/api/agent": [Role.SUPER_AGENT, Role.AGENCY, Role.ADMIN],
};

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent") || "";
  const country =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    (request as any).geo?.country;

  // 1. GEO-BLOCKING: Chỉ cho phép truy cập từ Việt Nam (VN) trên môi trường Production
  // Ngoại lệ: UptimeRobot (/api/health) và Zalo Webhooks/Verification
  const isUptimeMonitor =
    pathname === "/api/health" ||
    userAgent.toLowerCase().includes("uptimerobot");
  const isZaloIntegration =
    pathname.includes("zalo") ||
    pathname.includes("zalo_verifier");

  if (
    process.env.NODE_ENV === "production" &&
    country &&
    country.toUpperCase() !== "VN" &&
    !isUptimeMonitor &&
    !isZaloIntegration
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "GEO_RESTRICTED",
          message: "Dịch vụ VFC chỉ khả dụng tại lãnh thổ Việt Nam.",
        },
        { status: 403 }
      );
    }

    return new NextResponse(
      `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>403 - Giới hạn khu vực</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#f8fafc;text-align:center;padding:20px;">
  <div>
    <h1 style="font-size:2.2rem;margin-bottom:8px;color:#ef4444;">403 Forbidden</h1>
    <p style="font-size:1.1rem;color:#94a3b8;">Hệ thống VFC Nông Dân chỉ khả dụng tại khu vực Việt Nam.</p>
    <p style="font-size:0.85rem;color:#64748b;">(VFC services are restricted to Vietnam territory only)</p>
  </div>
</body>
</html>`,
      {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  // Allow public paths
  if (matchesPrefix(pathname, PUBLIC_PATHS)) {
    return NextResponse.next();
  }

  // Get token from Authorization header first, fallback to cookie
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const token = bearerToken || request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  logger.info(`[Middleware] Path: ${pathname}, Token: ${!!token}, Session: ${!!session}`);

  // Not authenticated → redirect to login
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check role-based access
  for (const [prefix, allowedRoles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(prefix) && !allowedRoles.includes(session.role)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/403", request.url));
    }
  }

  // Inject user info into headers for route handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", session.sub);
  requestHeaders.set("x-user-role", session.role);
  requestHeaders.set("x-user-phone", session.phone);
  if (session.sessionId) {
    requestHeaders.set("x-user-session", session.sessionId);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
