import { prisma } from "@/lib/prisma";

export interface ZaloStatusSummary {
  configured: boolean;
  enabled: boolean;
  expiresAt: Date | null;
  accessTokenMasked?: string;
  refreshTokenMasked?: string;
  isExpiringSoon?: boolean;
}

export class ZaloTokenManager {
  private static instance: ZaloTokenManager;

  private constructor() {}

  public static getInstance(): ZaloTokenManager {
    if (!ZaloTokenManager.instance) {
      ZaloTokenManager.instance = new ZaloTokenManager();
    }
    return ZaloTokenManager.instance;
  }

  /**
   * Lấy Access Token còn hiệu lực từ Database.
   * Tự động refresh nếu token sắp/đã hết hạn (còn ít hơn 10 phút).
   * Yêu cầu chứng thực Zalo phải ở trạng thái enabled = true.
   */
  async getAccessToken(): Promise<string> {
    const tokenRecord = await prisma.zaloAuthToken.findUnique({
      where: { id: "default" },
    });

    if (!tokenRecord) {
      throw new Error(
        "Chưa có Zalo Token trong Database. Vui lòng kích hoạt bằng tay trong Admin > Cài đặt."
      );
    }

    if (!tokenRecord.enabled) {
      throw new Error(
        "Chứng thực Zalo hiện đang bị TẮT trong Admin > Cài đặt."
      );
    }

    const tenMinutesInMs = 10 * 60 * 1000;
    const isExpiringSoon =
      tokenRecord.expiresAt.getTime() - Date.now() < tenMinutesInMs;

    if (!isExpiringSoon) {
      return tokenRecord.accessToken;
    }

    // Token sắp/đã hết hạn -> Gọi refresh bằng refresh_token từ DB
    console.log("[ZaloTokenManager] Token expiring soon, refreshing from DB refresh token...");
    if (tokenRecord.refreshToken) {
      const newToken = await this.refreshAccessToken(tokenRecord.refreshToken);
      if (newToken) return newToken;
    }

    throw new Error("Không thể tự động refresh Zalo Access Token. Vui lòng kích hoạt lại trong Admin > Cài đặt.");
  }

  /**
   * Đổi Refresh Token lấy Access Token mới thông qua Zalo OAuth API
   */
  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    const appId = process.env.ZALO_APP_ID;
    const appSecret = process.env.ZALO_APP_SECRET;

    if (!appId || !appSecret || !refreshToken) {
      console.warn(
        "[ZaloTokenManager] Thiếu ZALO_APP_ID, ZALO_APP_SECRET hoặc Refresh Token để thực hiện refresh."
      );
      return null;
    }

    try {
      const params = new URLSearchParams();
      params.append("refresh_token", refreshToken);
      params.append("app_id", appId);
      params.append("grant_type", "refresh_token");

      const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: appSecret,
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.access_token) {
        const expiresInSeconds = Number(data.expires_in) || 90000;
        const newRefreshToken = data.refresh_token || refreshToken;

        await this.saveTokens(data.access_token, newRefreshToken, expiresInSeconds);
        console.log("[ZaloTokenManager] Refreshed Zalo Access Token successfully.");
        return data.access_token;
      } else {
        console.error("[ZaloTokenManager] Refresh token failed:", data);
        return null;
      }
    } catch (error) {
      console.error("[ZaloTokenManager] Exception during token refresh:", error);
      return null;
    }
  }

  /**
   * Đổi Authorization Code lấy Access Token & Refresh Token mới, lưu vào Database
   * @param code - authorization_code từ Zalo OAuth
   * @param codeVerifier - PKCE code_verifier (tùy chọn, Zalo v4 API khuyến nghị dùng PKCE)
   */
  async exchangeAuthorizationCode(code: string, codeVerifier?: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    data?: any;
  }> {
    const appId = process.env.ZALO_APP_ID;
    const appSecret = process.env.ZALO_APP_SECRET;

    if (!appId || !appSecret) {
      return {
        success: false,
        error: "Thiếu cấu hình ZALO_APP_ID hoặc ZALO_APP_SECRET trong môi trường (.env)",
      };
    }

    try {
      const params = new URLSearchParams();
      params.append("code", code);
      params.append("app_id", appId);
      params.append("grant_type", "authorization_code");
      if (codeVerifier) {
        params.append("code_verifier", codeVerifier);
      }

      console.log(`[ZaloTokenManager] Exchange request - app_id: ${appId}, code length: ${code.length}, code_verifier: ${codeVerifier ? `present (${codeVerifier.length} chars)` : "MISSING"}`);

      const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: appSecret,
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.access_token && data.refresh_token) {
        const expiresInSeconds = Number(data.expires_in) || 90000;

        await this.saveTokens(data.access_token, data.refresh_token, expiresInSeconds, true);

        return {
          success: true,
          message: "Kích hoạt Chứng thực Zalo thành công và đã lưu token vào Database!",
          data: {
            expiresInSeconds,
            accessTokenMasked: data.access_token.substring(0, 10) + "...",
            refreshTokenMasked: data.refresh_token.substring(0, 10) + "...",
          },
        };
      } else {
        return {
          success: false,
          error: data.message || "Đổi authorization_code lấy token thất bại",
          data,
        };
      }
    } catch (error: any) {
      console.error("[ZaloTokenManager] Code exchange exception:", error);
      return {
        success: false,
        error: error?.message || "Lỗi kết nối tới Zalo OAuth API",
      };
    }
  }

  /**
   * Bật hoặc Tắt trạng thái chứng thực Zalo trong Database
   */
  async setAuthEnabled(enabled: boolean): Promise<boolean> {
    const existing = await prisma.zaloAuthToken.findUnique({
      where: { id: "default" },
    });

    if (!existing) {
      throw new Error("Chưa có cấu hình Zalo token trong DB để bật/tắt. Hãy kích hoạt bằng authorization_code trước.");
    }

    await prisma.zaloAuthToken.update({
      where: { id: "default" },
      data: { enabled },
    });

    return enabled;
  }

  /**
   * Lấy tổng quan trạng thái Zalo Authentication hiện tại
   */
  async getTokenStatus(): Promise<ZaloStatusSummary> {
    const record = await prisma.zaloAuthToken.findUnique({
      where: { id: "default" },
    });

    if (!record) {
      return {
        configured: false,
        enabled: false,
        expiresAt: null,
      };
    }

    const tenMinutesInMs = 10 * 60 * 1000;
    const isExpiringSoon = record.expiresAt.getTime() - Date.now() < tenMinutesInMs;

    return {
      configured: true,
      enabled: record.enabled,
      expiresAt: record.expiresAt,
      accessTokenMasked: record.accessToken ? record.accessToken.substring(0, 8) + "..." + record.accessToken.slice(-6) : undefined,
      refreshTokenMasked: record.refreshToken ? record.refreshToken.substring(0, 8) + "..." + record.refreshToken.slice(-6) : undefined,
      isExpiringSoon,
    };
  }

  /**
   * Lưu hoặc cập nhật Tokens vào Database
   */
  async saveTokens(
    accessToken: string,
    refreshToken: string,
    expiresInSeconds: number,
    enabled: boolean = true
  ) {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await prisma.zaloAuthToken.upsert({
      where: { id: "default" },
      update: {
        accessToken,
        refreshToken,
        expiresAt,
        enabled,
      },
      create: {
        id: "default",
        accessToken,
        refreshToken,
        expiresAt,
        enabled,
      },
    });
  }
}
