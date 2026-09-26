import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/** Thời hạn mặc định của Zalo Refresh Token: 90 ngày */
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 90 * 24 * 60 * 60; // 7,776,000s

/** Ngưỡng cảnh báo Refresh Token */
const WARNING_DAYS = 30; // Còn < 30 ngày → vàng
const CRITICAL_DAYS = 7; // Còn < 7 ngày → đỏ

/** Ngưỡng tối thiểu & tối đa cho refresh threshold (giây) */
export const MIN_REFRESH_THRESHOLD_SECONDS = 60; // 1 phút
export const MAX_REFRESH_THRESHOLD_SECONDS = 86400; // 24 giờ
export const DEFAULT_REFRESH_THRESHOLD_SECONDS = 14400; // 4 giờ

export type ZaloAlertLevel = "ok" | "warning" | "critical" | "expired" | "unknown";

export interface ZaloStatusSummary {
  configured: boolean;
  enabled: boolean;
  expiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  accessTokenMasked?: string;
  refreshTokenMasked?: string;
  isExpiringSoon?: boolean;
  /** Cấp độ cảnh báo dựa trên Refresh Token còn lại bao nhiêu ngày */
  refreshTokenAlertLevel: ZaloAlertLevel;
  /** Số ngày còn lại của Refresh Token (null nếu chưa có data) */
  refreshTokenDaysLeft: number | null;
  /** Ngưỡng tự động refresh trước khi Access Token hết hạn (giây) */
  refreshThresholdSeconds: number;
  /** Thời điểm hệ thống sẽ tự động kích hoạt refresh Access Token */
  autoRefreshScheduledAt: Date | null;
  /** Số giây còn lại cho đến lần auto-refresh tiếp theo */
  timeUntilAutoRefreshSeconds: number | null;
}

export interface RefreshTokenResult {
  success: boolean;
  accessToken?: string;
  error?: string;
  errorCode?: number;
}

export class ZaloTokenManager {
  private static instance: ZaloTokenManager;
  /** Mutex Lock: Promise của request refresh đang chạy ngầm để chống Race Condition */
  private refreshPromise: Promise<RefreshTokenResult> | null = null;

  private constructor() {}

  public static getInstance(): ZaloTokenManager {
    if (!ZaloTokenManager.instance) {
      ZaloTokenManager.instance = new ZaloTokenManager();
    }
    return ZaloTokenManager.instance;
  }

  /**
   * Tính cấp độ cảnh báo dựa trên Refresh Token expiry
   */
  private computeAlertLevel(refreshTokenExpiresAt: Date | null): {
    level: ZaloAlertLevel;
    daysLeft: number | null;
  } {
    if (!refreshTokenExpiresAt) {
      return { level: "unknown", daysLeft: null };
    }

    const msLeft = refreshTokenExpiresAt.getTime() - Date.now();
    const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));

    if (msLeft <= 0) return { level: "expired", daysLeft: 0 };
    if (daysLeft < CRITICAL_DAYS) return { level: "critical", daysLeft };
    if (daysLeft < WARNING_DAYS) return { level: "warning", daysLeft };
    return { level: "ok", daysLeft };
  }

  /**
   * Lấy Access Token còn hiệu lực từ Database.
   * Tự động refresh nếu token sắp/đã hết hạn dựa trên refreshThresholdSeconds đã cấu hình.
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

    const thresholdSeconds = tokenRecord.refreshThresholdSeconds ?? DEFAULT_REFRESH_THRESHOLD_SECONDS;
    const thresholdMs = thresholdSeconds * 1000;
    const isExpiringSoon =
      tokenRecord.expiresAt.getTime() - Date.now() < thresholdMs;

    if (!isExpiringSoon && tokenRecord.accessToken) {
      return tokenRecord.accessToken;
    }

    // Token sắp/đã hết hạn theo ngưỡng -> Gọi refresh bằng refresh_token từ DB
    logger.info(
      `[ZaloTokenManager] Token remaining time < threshold (${thresholdSeconds}s), auto-refreshing from DB refresh token...`
    );
    if (tokenRecord.refreshToken) {
      const result = await this.refreshAccessTokenDetailed(tokenRecord.refreshToken);
      if (result.success && result.accessToken) return result.accessToken;
      throw new Error(
        `Không thể tự động refresh Zalo Access Token: ${result.error || "Zalo từ chối refresh token"}`
      );
    }

    throw new Error(
      "Không thể tự động refresh Zalo Access Token: Thiếu Refresh Token trong Database. Vui lòng kiểm tra lại trong Admin > Cài đặt."
    );
  }

  /**
   * Đổi Refresh Token lấy Access Token mới thông qua Zalo OAuth API (trả về kết quả chi tiết).
   * Tích hợp In-flight Promise Mutex để chống Race Condition khi nhiều request gọi cùng lúc.
   */
  async refreshAccessTokenDetailed(refreshToken: string): Promise<RefreshTokenResult> {
    // Nếu đang có tiến trình refresh chạy dở, tái sử dụng Promise đó
    if (this.refreshPromise) {
      logger.info("[ZaloTokenManager] Refresh already in progress, awaiting existing promise...");
      return this.refreshPromise;
    }

    const appId = process.env.ZALO_APP_ID;
    const appSecret = process.env.ZALO_APP_SECRET;

    if (!appId || !appSecret) {
      const err = "Thiếu cấu hình ZALO_APP_ID hoặc ZALO_APP_SECRET trong biến môi trường (.env).";
      logger.warn(`[ZaloTokenManager] ${err}`);
      return { success: false, error: err };
    }

    if (!refreshToken || !refreshToken.trim()) {
      const err = "Thiếu Refresh Token để thực hiện làm mới.";
      logger.warn(`[ZaloTokenManager] ${err}`);
      return { success: false, error: err };
    }

    this.refreshPromise = (async (): Promise<RefreshTokenResult> => {
      try {
        const params = new URLSearchParams();
        params.append("refresh_token", refreshToken.trim());
        params.append("app_id", appId.trim());
        params.append("grant_type", "refresh_token");

        const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            secret_key: appSecret.trim(),
          },
          body: params.toString(),
        });

        const data = await response.json();

        if (data.access_token) {
          const expiresInSeconds = Number(data.expires_in) || 90000;
          const newRefreshToken = data.refresh_token || refreshToken;

          // Khi refresh, Zalo cấp lại refresh_token mới → reset lại 90 ngày
          const refreshTokenChanged = !!data.refresh_token && data.refresh_token !== refreshToken;
          await this.saveTokens(
            data.access_token,
            newRefreshToken,
            expiresInSeconds,
            true,
            refreshTokenChanged ? REFRESH_TOKEN_EXPIRES_IN_SECONDS : undefined
          );
          logger.info("[ZaloTokenManager] Refreshed Zalo Access Token successfully.");
          return { success: true, accessToken: data.access_token as string };
        } else {
          logger.error("[ZaloTokenManager] Refresh token failed from Zalo API:", data);
          const errorCode = data.error;
          const errorMsg = data.error_description || data.message || data.error_name || "Lỗi không xác định từ Zalo OAuth";

          let friendlyError = `Zalo OAuth API lỗi: ${errorMsg} (Mã lỗi: ${errorCode ?? "OA"})`;
          if (errorCode === -14014 || String(errorMsg).toLowerCase().includes("invalid refresh token")) {
            friendlyError = "Refresh Token không hợp lệ (-14014) hoặc đã hết hạn 90 ngày / đã bị thu hồi. Lưu ý: Refresh Token là mã riêng biệt khác với Access Token; nếu dán nhầm Access Token vào ô Refresh Token thì Zalo sẽ từ chối.";
          } else if (errorCode === -14002 || String(errorMsg).toLowerCase().includes("invalid app id")) {
            friendlyError = `Zalo App ID không hợp lệ (-14002). Vui lòng kiểm tra lại cấu hình ZALO_APP_ID (${appId}).`;
          } else if (errorCode === -14004 || String(errorMsg).toLowerCase().includes("invalid secret key")) {
            friendlyError = "Zalo Secret Key không hợp lệ (-14004). Vui lòng kiểm tra lại cấu hình ZALO_APP_SECRET.";
          }

          return {
            success: false,
            error: friendlyError,
            errorCode,
          };
        }
      } catch (error: any) {
        logger.error("[ZaloTokenManager] Exception during token refresh:", error);
        return {
          success: false,
          error: error?.message || "Lỗi kết nối tới Zalo OAuth API",
        };
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Đổi Refresh Token lấy Access Token mới thông qua Zalo OAuth API.
   */
  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    const result = await this.refreshAccessTokenDetailed(refreshToken);
    return result.success ? (result.accessToken ?? null) : null;
  }

  /**
   * Kích hoạt làm mới Token chủ động (dùng cho nút Bấm Làm mới trên Admin hoặc Cron Job)
   */
  async forceRefresh(): Promise<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  }> {
    const record = await prisma.zaloAuthToken.findUnique({
      where: { id: "default" },
    });

    if (!record || !record.refreshToken) {
      return {
        success: false,
        error: "Chưa có cấu hình Zalo Refresh Token trong Database để làm mới.",
        message: "Chưa có Refresh Token trong Database.",
      };
    }

    if (record.accessToken && record.refreshToken && record.accessToken.trim() === record.refreshToken.trim()) {
      return {
        success: false,
        error: "Refresh Token trong Database đang trùng khớp với Access Token (đang bị dán nhầm cùng một mã). Access Token dùng để gửi OTP, nhưng để làm mới bạn cần lấy mã Refresh Token riêng biệt từ Zalo Developer Console và dán lại.",
        message: "Refresh Token bị trùng với Access Token.",
      };
    }

    const result = await this.refreshAccessTokenDetailed(record.refreshToken);

    if (result.success && result.accessToken) {
      const updatedStatus = await this.getTokenStatus();
      return {
        success: true,
        message: "Làm mới Zalo Access Token và Refresh Token thành công!",
        data: updatedStatus,
      };
    } else {
      return {
        success: false,
        error: result.error || "Làm mới token thất bại từ Zalo OAuth API.",
        message: result.error || "Làm mới token thất bại từ Zalo OAuth API.",
      };
    }
  }

  /**
   * Cập nhật ngưỡng thời gian tự động làm mới (giây)
   * @param seconds Số giây từ 60 (1 phút) đến 86400 (24 giờ)
   */
  async setRefreshThreshold(seconds: number): Promise<number> {
    if (
      isNaN(seconds) ||
      seconds < MIN_REFRESH_THRESHOLD_SECONDS ||
      seconds > MAX_REFRESH_THRESHOLD_SECONDS
    ) {
      throw new Error(
        `Ngưỡng thời gian phải là số nguyên từ ${MIN_REFRESH_THRESHOLD_SECONDS} giây (1 phút) đến ${MAX_REFRESH_THRESHOLD_SECONDS} giây (24 giờ).`
      );
    }

    const record = await prisma.zaloAuthToken.upsert({
      where: { id: "default" },
      update: { refreshThresholdSeconds: seconds },
      create: {
        id: "default",
        accessToken: "",
        refreshToken: "",
        expiresAt: new Date(Date.now() + 90000 * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000),
        enabled: true,
        refreshThresholdSeconds: seconds,
      },
    });

    return record.refreshThresholdSeconds;
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

      logger.info(
        `[ZaloTokenManager] Exchange request - app_id: ${appId}, code length: ${code.length}, code_verifier: ${
          codeVerifier ? `present (${codeVerifier.length} chars)` : "MISSING"
        }`
      );

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

        await this.saveTokens(
          data.access_token,
          data.refresh_token,
          expiresInSeconds,
          true,
          REFRESH_TOKEN_EXPIRES_IN_SECONDS
        );

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
      logger.error("[ZaloTokenManager] Code exchange exception:", error);
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
      throw new Error(
        "Chưa có cấu hình Zalo token trong DB để bật/tắt. Hãy kích hoạt hoặc nhập token trước."
      );
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
        refreshTokenExpiresAt: null,
        refreshTokenAlertLevel: "unknown",
        refreshTokenDaysLeft: null,
        refreshThresholdSeconds: DEFAULT_REFRESH_THRESHOLD_SECONDS,
        autoRefreshScheduledAt: null,
        timeUntilAutoRefreshSeconds: null,
      };
    }

    const thresholdSeconds = record.refreshThresholdSeconds ?? DEFAULT_REFRESH_THRESHOLD_SECONDS;
    const thresholdMs = thresholdSeconds * 1000;
    const isExpiringSoon = record.expiresAt.getTime() - Date.now() < thresholdMs;

    const { level, daysLeft } = this.computeAlertLevel(record.refreshTokenExpiresAt);

    // Tính thời điểm auto-refresh theo ngưỡng
    const autoRefreshScheduledAt = new Date(record.expiresAt.getTime() - thresholdMs);
    const msUntilAutoRefresh = autoRefreshScheduledAt.getTime() - Date.now();
    const timeUntilAutoRefreshSeconds = Math.floor(msUntilAutoRefresh / 1000);

    return {
      configured: true,
      enabled: record.enabled,
      expiresAt: record.expiresAt,
      refreshTokenExpiresAt: record.refreshTokenExpiresAt,
      accessTokenMasked: record.accessToken
        ? record.accessToken.substring(0, 8) + "..." + record.accessToken.slice(-6)
        : undefined,
      refreshTokenMasked: record.refreshToken
        ? record.refreshToken.substring(0, 8) + "..." + record.refreshToken.slice(-6)
        : undefined,
      isExpiringSoon,
      refreshTokenAlertLevel: level,
      refreshTokenDaysLeft: daysLeft,
      refreshThresholdSeconds: thresholdSeconds,
      autoRefreshScheduledAt,
      timeUntilAutoRefreshSeconds,
    };
  }

  /**
   * Lưu hoặc cập nhật Tokens vào Database.
   * @param refreshTokenExpiresInSeconds - Nếu undefined, không cập nhật refreshTokenExpiresAt (giữ nguyên giá trị cũ)
   */
  async saveTokens(
    accessToken: string,
    refreshToken: string,
    expiresInSeconds: number,
    enabled: boolean = true,
    refreshTokenExpiresInSeconds?: number,
    refreshThresholdSeconds?: number
  ) {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const refreshTokenExpiresAt =
      refreshTokenExpiresInSeconds !== undefined
        ? new Date(Date.now() + refreshTokenExpiresInSeconds * 1000)
        : undefined;

    await prisma.zaloAuthToken.upsert({
      where: { id: "default" },
      update: {
        accessToken,
        refreshToken,
        expiresAt,
        enabled,
        ...(refreshTokenExpiresAt !== undefined ? { refreshTokenExpiresAt } : {}),
        ...(refreshThresholdSeconds !== undefined ? { refreshThresholdSeconds } : {}),
      },
      create: {
        id: "default",
        accessToken,
        refreshToken,
        expiresAt,
        refreshTokenExpiresAt:
          refreshTokenExpiresAt ??
          new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000),
        enabled,
        refreshThresholdSeconds: refreshThresholdSeconds ?? DEFAULT_REFRESH_THRESHOLD_SECONDS,
      },
    });
  }
}
