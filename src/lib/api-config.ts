/**
 * Cấu hình API Server Base URL
 * - Nếu NEXT_PUBLIC_AUTH_SERVER_URL có giá trị (ví dụ: http://localhost:3002/api/v1 hoặc URL Render):
 *   -> Client sẽ gửi request trực tiếp sang vfc-server (NestJS).
 * - Nếu để trống / undefined:
 *   -> Client sẽ fallback sử dụng Next.js internal routes (/api/auth/...).
 */
export const AUTH_SERVER_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVER_URL?.replace(/\/$/, '') || '';

export const isNestAuthEnabled = (): boolean => {
  return Boolean(AUTH_SERVER_URL);
};
