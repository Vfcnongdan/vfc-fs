import { NextRequest, NextResponse } from "next/server";
import { ZaloTokenManager } from "@/services/zalo/ZaloTokenManager";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.json(
      { error: "MISSING_CODE", message: "Không tìm thấy tham số code trong URL callback" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("zalo_pkce_code_verifier")?.value;
  const storedState = cookieStore.get("zalo_pkce_state")?.value;

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