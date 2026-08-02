import { NextRequest, NextResponse } from "next/server";
import { ZaloTokenManager } from "@/services/zalo/ZaloTokenManager";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "MISSING_CODE", message: "Không tìm thấy tham số code trong URL callback" },
      { status: 400 }
    );
  }

  const result = await ZaloTokenManager.getInstance().exchangeAuthorizationCode(code);

  if (result.success) {
    return NextResponse.json(result);
  } else {
    return NextResponse.json(
      { error: "EXCHANGE_TOKEN_FAILED", message: result.error, details: result.data },
      { status: 400 }
    );
  }
}
