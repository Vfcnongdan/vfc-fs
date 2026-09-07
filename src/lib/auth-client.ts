import { AUTH_SERVER_URL, isNestAuthEnabled } from './api-config';
import { COOKIE_NAME } from './auth';

export const STORAGE_KEYS = {
  TOKEN: 'vfc_token',
  BROWSER_CRED: 'vfc_browser_cred',
  LAST_PHONE: 'lastPhone',
};

export interface StoredBrowserCredential {
  id: string;
  token: string;
  expiresAt?: string;
}

export interface RequestOtpResult {
  success: boolean;
  challengeId?: string;
  method?: string;
  hasValidCredential?: boolean;
  fallbackAfter?: number;
  message?: string;
  error?: string;
  retryAfter?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    phone: string;
    role: string;
    name?: string;
  };
  browserCredential?: StoredBrowserCredential;
  error?: string;
  message?: string;
}

// ── 1. Storage & Cookie Helpers ─────────────────────────────────────

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);

  // Đồng bộ Cookie để Next.js SSR middleware.ts vẫn đọc được khi chuyển trang
  const isSecure = window.location.protocol === 'https:';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    token,
  )}; path=/; max-age=${60 * 60 * 24 * 60}; SameSite=Lax${
    isSecure ? '; Secure' : ''
  }`;
}

export function removeStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.TOKEN);

  // Xóa Cookie
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

export function getStoredCredential(): StoredBrowserCredential | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BROWSER_CRED);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredCredential(cred: StoredBrowserCredential): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.BROWSER_CRED, JSON.stringify(cred));
}

export function removeStoredCredential(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.BROWSER_CRED);
}

// ── 2. API Methods ──────────────────────────────────────────────────

/**
 * Gửi yêu cầu mã OTP
 */
export async function requestOtp(
  phone: string,
  connectionId?: string,
): Promise<RequestOtpResult> {
  // Lưu lại SĐT cuối để điền sẵn
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.LAST_PHONE, phone);
  }

  if (isNestAuthEnabled()) {
    const cred = getStoredCredential();
    const payload: Record<string, any> = { phone };
    if (connectionId) payload.connectionId = connectionId;
    if (cred?.id && cred?.token) {
      payload.credentialId = cred.id;
      payload.credentialToken = cred.token;
    }

    const res = await fetch(`${AUTH_SERVER_URL}/auth/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'REQUEST_FAILED',
        message: data.message || 'Không thể yêu cầu mã OTP lúc này.',
        retryAfter: data.retryAfter,
      };
    }

    return {
      success: true,
      challengeId: data.challengeId,
      method: data.method,
      hasValidCredential: data.hasValidCredential,
      fallbackAfter: data.fallbackAfter,
      message: data.message,
    };
  }

  // Fallback: Legacy Next.js route
  const res = await fetch('/api/auth/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  const data = await res.json();
  if (!res.ok) {
    return {
      success: false,
      error: data.error || 'REQUEST_FAILED',
      message: data.message || 'Không thể yêu cầu mã OTP.',
    };
  }

  return { success: true, message: data.message };
}

/**
 * Xác thực mã OTP và đăng nhập
 */
export async function verifyOtp(
  challengeIdOrPhone: string,
  otp: string,
  phoneFallback?: string,
): Promise<VerifyOtpResult> {
  if (isNestAuthEnabled()) {
    const res = await fetch(`${AUTH_SERVER_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: challengeIdOrPhone,
        otp,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'VERIFY_FAILED',
        message: data.message || 'Mã OTP không chính xác.',
      };
    }

    // Lưu Token và Browser Credential
    if (data.token) {
      setStoredToken(data.token);
    }
    if (data.browserCredential) {
      saveStoredCredential(data.browserCredential);
    }

    return {
      success: true,
      token: data.token,
      user: data.user,
      browserCredential: data.browserCredential,
    };
  }

  // Fallback: Legacy Next.js route
  const res = await fetch('/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: phoneFallback || challengeIdOrPhone,
      otp,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return {
      success: false,
      error: data.error || 'VERIFY_FAILED',
      message: data.message || 'Xác thực OTP thất bại.',
    };
  }

  return {
    success: true,
    user: data.user,
  };
}

/**
 * Lấy thông tin tài khoản hiện tại
 */
export async function getMe(): Promise<{ success: boolean; user?: any }> {
  if (isNestAuthEnabled()) {
    const token = getStoredToken();
    if (!token) return { success: false };

    try {
      const res = await fetch(`${AUTH_SERVER_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        removeStoredToken();
        return { success: false };
      }

      const data = await res.json();
      return { success: true, user: data.user };
    } catch {
      return { success: false };
    }
  }

  // Fallback: Legacy Next.js route
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      // Server trả 401 → session đã bị revoke, xóa localStorage token để đồng bộ
      removeStoredToken();
      return { success: false };
    }
    const data = await res.json();
    return { success: true, user: data.user };
  } catch {
    return { success: false };
  }
}

/**
 * Đăng xuất
 */
export async function logout(): Promise<void> {
  const token = getStoredToken();

  if (isNestAuthEnabled() && token) {
    try {
      await fetch(`${AUTH_SERVER_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {}
  } else {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
  }

  removeStoredToken();
}
