import { NextRequest, NextResponse } from "next/server";
import { ZaloTokenManager } from "@/services/zalo/ZaloTokenManager";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const codeChallenge = searchParams.get("code_challenge");

  logger.info(`[Zalo Callback] URL: ${request.nextUrl.pathname}, Host: ${request.headers.get("host")}`);

  if (!code) {
    return NextResponse.json(
      { error: "MISSING_CODE", message: "Không tìm thấy tham số code trong URL callback" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("zalo_pkce_code_verifier")?.value;
  const storedState = cookieStore.get("zalo_pkce_state")?.value;

  logger.info(`[Zalo Callback] code_verifier cookie present: ${!!codeVerifier}, state cookie present: ${!!storedState}`);
  logger.info(`[Zalo Callback] URL state: ${state}, Cookie state: ${storedState}`);

  if (!codeVerifier) {
    logger.error("[Zalo Callback] code_verifier cookie is MISSING! This is likely a domain mismatch issue (www vs non-www).");
    return NextResponse.json(
      {
        error: "MISSING_CODE_VERIFIER",
        message: "Cookie code_verifier bị mất. Nguyên nhân có thể do domain không khớp (www vs non-www). Hãy đảm bảo ZALO_CALLBACK_URL dùng cùng domain với trang admin.",
        debug: {
          host: request.headers.get("host"),
          callbackUrl: process.env.ZALO_CALLBACK_URL,
        },
      },
      { status: 400 }
    );
  }

  if (state && storedState && state !== storedState) {
    cookieStore.delete("zalo_pkce_code_verifier");
    cookieStore.delete("zalo_pkce_state");
    return NextResponse.json(
      { error: "INVALID_STATE", message: "State parameter không khớp, có thể là tấn công CSRF" },
      { status: 400 }
    );
  }

  const result = await ZaloTokenManager.getInstance().exchangeAuthorizationCode(code, codeVerifier);

  cookieStore.delete("zalo_pkce_code_verifier");
  cookieStore.delete("zalo_pkce_state");

  if (result.success) {
    return NextResponse.redirect(new URL("/admin/settings", request.url));
  } else {
    return NextResponse.json(
      { error: "EXCHANGE_TOKEN_FAILED", message: result.error, details: result.data },
      { status: 400 }
    );
  }
}