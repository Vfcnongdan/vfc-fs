import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/auth";

/**
 * Bridge route: Nhận JWT từ client (được cấp bởi vfc-server) và set HttpOnly Cookie qua server.
 *
 * Tại sao cần endpoint này?
 * - Cookie `vfc_token` từ hệ thống cũ mang cờ `HttpOnly: true`.
 * - JavaScript phía client (document.cookie) bị trình duyệt chặn âm thầm khi cố ghi đè
 *   một HttpOnly cookie hiện có (RFC 6265).
 * - Chỉ có HTTP Response Header `Set-Cookie` từ server mới có thể ghi đè hoàn toàn.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const token: string | undefined = body?.token;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "INVALID_INPUT", message: "Token không hợp lệ." },
        { status: 400 }
      );
    }

    // Xác thực token trước khi set vào cookie (tránh bị inject token giả)
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: "JWT Token không hợp lệ hoặc đã hết hạn." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    // Set-Cookie từ server response có TOÀN QUYỀN ghi đè cookie HttpOnly cũ:
    response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err.message },
      { status: 500 }
    );
  }
}
