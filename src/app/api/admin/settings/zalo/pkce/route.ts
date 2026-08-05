import { NextRequest, NextResponse } from "next/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildZaloAuthorizationUrl,
} from "@/lib/zaloPKCE";
import { getRequestUser, requireRole, apiError, apiOk } from "@/lib/request";
import { Role } from "@prisma/client";
import { cookies } from "next/headers";

/**
 * GET /api/admin/settings/zalo/pkce
 * Khởi tạo PKCE flow: tạo code_verifier, code_challenge, state,
 * lưu vào cookie, và trả về URL redirect tới Zalo authorization endpoint.
 */
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    const cookieStore = await cookies();
    cookieStore.set("zalo_pkce_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });
    cookieStore.set("zalo_pkce_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });

    const authUrl = buildZaloAuthorizationUrl(codeChallenge, state);

    return apiOk({
      success: true,
      authorizationUrl: authUrl,
    });
  } catch (error: any) {
    return apiError(
      error?.message || "Lỗi khi khởi tạo PKCE flow",
      500
    );
  }
}