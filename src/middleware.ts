import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME, Role } from "@/lib/auth";

// Route protection config
const PUBLIC_PATHS = ["/", "/assets", "/api/auth/otp/send", "/api/auth/otp/verify", "/zalo_verifierOyIX99Bk6tXmqSnrjELRVNV3wrIRjJ4FCpap.html"];
const ROLE_PATHS: Record<string, Role[]> = {
  "/api/admin": [Role.ADMIN],
  "/admin/orders": [Role.ADMIN, Role.AGENCY, Role.SUPER_AGENT, Role.MDO, Role.SE],
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

  // Allow public paths
  if (matchesPrefix(pathname, PUBLIC_PATHS)) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  console.log(`[Middleware] Path: ${pathname}, Token: ${!!token}, Session: ${!!session}`);

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
