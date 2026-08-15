# Walkthrough - Triển khai Gửi OTP Đồng thời qua Cả 2 Kênh (Zalo + Telegram)

Theo yêu cầu mới nhất, hệ thống đã được nâng cấp để **gửi mã OTP đồng thời (simultaneous) qua cả 2 kênh Zalo và Telegram** cùng lúc, thay vì dùng Telegram như một phương án dự phòng đơn thuần.

---

## Các thay đổi chính

### 1. Class `MultiChannelOtpService`
- **[MultiChannelOtpService.ts](file:///c:/projects/vfc-fs/src/services/otp/MultiChannelOtpService.ts)**: Thực hiện gọi hàm gửi OTP của tất cả các kênh được đăng ký một cách **bất đồng bộ và song song (`Promise.allSettled`)**.
- Chỉ cần ít nhất 1 kênh gửi thành công, giao dịch OTP sẽ được coi là thành công.

### 2. Cập nhật `OtpServiceFactory` & API Route
- **[OtpServiceFactory.ts](file:///c:/projects/vfc-fs/src/services/otp/OtpServiceFactory.ts)**:
  - Khi `provider` là `"all"` (mặc định), factory sẽ trả về `MultiChannelOtpService` bao gồm cả 2 kênh **Zalo** và **Telegram**.
  - Vẫn giữ tùy chọn nếu client chỉ muốn chọn riêng `"zalo"` hoặc `"telegram"`.
- **[route.ts (OTP Send)](file:///c:/projects/vfc-fs/src/app/api/auth/otp/send/route.ts)**:
  - Cập nhật API `/api/auth/otp/send` mặc định gửi qua cả 2 kênh cùng lúc.
  - Phản hồi thông báo rõ ràng cho client: `"Mã OTP đã được gửi đồng thời qua Zalo và Telegram"`.

### 3. Kiểm tra TypeScript & Build
- Đã chạy kiểm tra `npx tsc --noEmit` thành công 100%, không có bất kỳ lỗi cú pháp hay kiểu dữ liệu nào.

# Kế hoạch Triển khai Zalo OTP Song Song với Telegram OTP & Quản lý Zalo Token

Kế hoạch này hạ tầng hệ thống OTP đa kênh (Multi-channel OTP), cho phép chạy song song dịch vụ **Telegram OTP** hiện tại và **Zalo OTP** mới, đồng thời giải quyết triệt để cơ chế Refresh Token của Zalo OA API.

---

## 1. Tổng quan Kiến trúc Song Song (Parallel Architecture)

### 1.1 Quản lý Dịch vụ OTP (OtpServiceFactory & Fallback)
Mở rộng kiến trúc Factory/Strategy đã có để hỗ trợ linh hoạt:
- **Kênh chỉ định (Explicit Provider):** Client có thể truyền thêm thuộc tính `provider: 'telegram' | 'zalo'` trong body request gửi OTP.
- **Kênh mặc định (Default Provider):** Lấy từ `process.env.OTP_SERVICE_PROVIDER` (mặc định `'zalo'` hoặc `'telegram'`).
- **Tự động chuyển kênh (Failover Strategy):** Nếu gửi qua Zalo thất bại (ví dụ: hết hạn token, số điện thoại chưa follow OA hoặc chưa đăng ký ZNS), hệ thống sẽ tự động fallback sang Telegram làm kênh dự phòng khẩn cấp.

---

## 2. Quản lý Zalo Access Token & Refresh Token (Zalo Token Manager)

Zalo OA quy định:
- **Access Token:** Hết hạn sau **25 giờ**.
- **Refresh Token:** Hết hạn sau **90 ngày**. Mỗi lần refresh thành công sẽ nhận được cặp Access Token mới và Refresh Token mới.

### 2.1 Cấu trúc Lưu trữ (Database Model)
Thêm model `SystemConfig` hoặc `ZaloAuthToken` vào [schema.prisma](file:///c:/projects/vfc-fs/prisma/schema.prisma) để lưu token bền vững:

```prisma
model ZaloAuthToken {
  id           String   @id @default("default")
  accessToken  String   @db.Text
  refreshToken String   @db.Text
  expiresAt    DateTime
  updatedAt    DateTime @updatedAt

  @@map("zalo_auth_tokens")
}
```

### 2.2 ZaloTokenManager Service
Tạo [ZaloTokenManager.ts](file:///c:/projects/vfc-fs/src/services/zalo/ZaloTokenManager.ts):
1. **`getValidAccessToken()`**:
   - Kiểm tra Token trong DB.
   - Nếu `expiresAt` còn trên 10 phút $\rightarrow$ trả về `accessToken`.
   - Nếu đã/sắp hết hạn $\rightarrow$ tự động gọi `refreshAccessToken()`.
2. **`refreshAccessToken()`**:
   - Gửi request đến `https://oauth.zaloapp.com/v4/oa/access_token` với header `secret_key` và body `grant_type: refresh_token`, `refresh_token`, `app_id`.
   - Cập nhật cặp token mới thu được vào DB.
3. **`saveInitialTokens(accessToken, refreshToken, expiresIn)`**:
   - Endpoint callback OAuth (`/api/auth/zalo/callback`) để khởi tạo token lần đầu tiên qua luồng cấp quyền Zalo OA.

---

## 3. Luồng Gửi Zalo OTP (ZNS / OA Message)

Đặc thù Zalo chỉ gửi được tin nhắn bằng 2 cách:
1. **Cách 1: Zalo Notification Service (ZNS)** - *Khuyên dùng cho gửi OTP qua SĐT*:
   - Endpoint: `https://business.openapi.zalo.me/message/template`
   - Điều kiện: Cần `template_id` và các tham số template (VD: `{ otp: "1234" }`).
2. **Cách 2: Zalo OA Follower Message**:
   - Endpoint: `https://openapi.zalo.me/v2.0/oa/message`
   - Điều kiện: Cần `user_id` Zalo của người dùng.

Trong kế hoạch này, `ZaloOtpService` sẽ hỗ trợ cả ZNS (gửi thẳng qua SĐT) lẫn OA Message (gửi qua Zalo User ID nếu có).

---

## 4. Các thay đổi chi tiết theo từng Component

### Backend Services & API

#### [NEW] [ZaloTokenManager.ts](file:///c:/projects/vfc-fs/src/services/zalo/ZaloTokenManager.ts)
- Quản lý đọc, lưu, kiểm tra thời gian hết hạn và làm mới Access Token Zalo OA tự động.

#### [MODIFY] [ZaloOtpService.ts](file:///c:/projects/vfc-fs/src/services/otp/ZaloOtpService.ts)
- Tích hợp `ZaloTokenManager` để luôn lấy Token mới nhất.
- Thêm hỗ trợ gửi ZNS qua SĐT (gửi request ZNS template) và giữ fallback gửi OA Message nếu có `zaloId`.

#### [NEW] [OtpServiceFactory.ts](file:///c:/projects/vfc-fs/src/services/otp/OtpServiceFactory.ts)
- Hàm `getOtpService(provider: 'telegram' | 'zalo')` khởi tạo service tương ứng.

#### [MODIFY] [route.ts (OTP Send)](file:///c:/projects/vfc-fs/src/app/api/auth/otp/send/route.ts)
- Nhận thêm field tùy chọn `provider` từ body (`'telegram' | 'zalo'`).
- Thực hiện gửi OTP qua kênh chọn. Nếu thất bại và kênh chính là Zalo, tự động thử lại qua Telegram.

#### [NEW] [route.ts (Zalo Callback)](file:///c:/projects/vfc-fs/src/app/api/auth/zalo/callback/route.ts)
- API nhận `code` OAuth khi Admin liên kết/refresh cấp quyền cho Zalo OA lần đầu tiên, đổi lấy Access Token & Refresh Token lưu vào DB.

---

### Database Schema

#### [MODIFY] [schema.prisma](file:///c:/projects/vfc-fs/prisma/schema.prisma)
- Thêm bảng `ZaloAuthToken` để quản lý token tập trung.

---

### Frontend UI (Tùy chọn chọn kênh)

#### [MODIFY] [page.tsx](file:///c:/projects/vfc-fs/src/app/page.tsx)
- Giữ trải nghiệm mặc định (hoặc thêm nút/icon chọn kênh nhận OTP: "Nhận qua Zalo" / "Nhận qua Telegram" nếu cần).

---

## 5. Kế hoạch Kiểm tra & Kịch bản Kiểm thử (Verification Plan)

### Kiểm thử Tự động & Unit/Integration Test
- Chạy `npx prisma db push` hoặc `npx prisma migrate dev` để tạo bảng `zalo_auth_tokens`.
- Chạy script kiểm thử refresh token Zalo giả lập hết hạn (`scratch/test-zalo-token.ts`).

### Kiểm thử Thủ công (Manual Verification)
1. **Kiểm thử Telegram OTP:** Đảm bảo kênh Telegram hiện tại hoạt động bình thường 100% không bị ảnh hưởng.
2. **Kiểm thử Zalo OTP (Dev mode & Prod):**
   - Trong môi trường Dev: Kiểm tra console log mã OTP.
   - Trong môi trường Prod: Kiểm tra tính khả thi của ZNS / Zalo OA message.
3. **Kiểm thử Tự động Refresh Token:**
   - Đặt thời gian hết hạn token giả định lùi về quá khứ trong DB, kích hoạt gửi OTP $\rightarrow$ Hệ thống tự gọi Zalo API lấy token mới và gửi OTP thành công.


# Implementation Plan - Zalo OAuth Admin Activation & Settings

Manage Zalo Access Token & Refresh Token strictly in Database (activated via Admin UI using Authorization Code), remove ENV token fallbacks, and add a Settings page in Admin portal.

## User Review Required

> [!IMPORTANT]
> - **Environment Fallback Removal**: Fallbacks to `ZALO_OA_TOKEN` and `ZALO_REFRESH_TOKEN` in `.env` will be completely removed from `ZaloTokenManager.ts`. All tokens must be generated via the Admin UI or Callback and saved in PostgreSQL.
> - **Schema Migration**: An `enabled` field (`Boolean @default(true)`) will be added to the `ZaloAuthToken` model in `prisma/schema.prisma`.

## Open Questions

- None at this time. All requirements match Zalo OA OAuth 2.0 specs and standard Next.js App Router admin page patterns.

## Proposed Changes

### Database Schema

#### [MODIFY] [schema.prisma](file:///c:/projects/vfc-fs/prisma/schema.prisma)
- Add `enabled Boolean @default(true) @map("enabled")` to `ZaloAuthToken` model.
- Run `npx prisma generate` and `npx prisma db push` to sync client and database.

---

### Core Services

#### [MODIFY] [ZaloTokenManager.ts](file:///c:/projects/vfc-fs/src/services/zalo/ZaloTokenManager.ts)
- Remove `process.env.ZALO_OA_TOKEN` and `process.env.ZALO_REFRESH_TOKEN` fallbacks from `getAccessToken()` and `refreshAccessToken()`.
- Check `tokenRecord.enabled` in `getAccessToken()`; if disabled (`enabled === false`), throw an error indicating Zalo authentication is turned off.
- Add `exchangeAuthorizationCode(code: string)` method to exchange `authorization_code` for tokens with Zalo API (`https://oauth.zaloapp.com/v4/oa/access_token`) and save them into the DB.
- Add helper methods to toggle `enabled` state (`setAuthEnabled(enabled: boolean)`) and retrieve token status summary.

---

### Admin Portal & UI

#### [MODIFY] [layout.tsx](file:///c:/projects/vfc-fs/src/app/admin/layout.tsx)
- Add `"Cài đặt"` menu item with icon `⚙️` pointing to `/admin/settings` in `menuItems`.

#### [NEW] [page.tsx](file:///c:/projects/vfc-fs/src/app/admin/settings/page.tsx)
- Create Admin Settings Page (`/admin/settings`).
- Structured in sections ("nhiều phần"), starting with **Phần 1: Cài đặt Chứng thực Zalo (OA / ZNS)**.
- Include:
  - Zalo Status Badge (Active/Inactive, Token Expiration Time, Masked Tokens).
  - Toggle Switch / Button for Bật / Tắt Chứng thực bằng Zalo.
  - Text input field for `authorization_code`.
  - Button "Kích hoạt Chứng thực Zalo" to send `authorization_code` to API and activate token.

---

### API Routes

#### [NEW] [route.ts](file:///c:/projects/vfc-fs/src/app/api/admin/settings/zalo/route.ts)
- `GET`: Return Zalo authentication status (is configured, `enabled`, expiration time, masked tokens).
- `POST`: Accept `{ code }`, trigger `exchangeAuthorizationCode(code)`, return success/error.
- `PATCH`: Accept `{ enabled }`, update `enabled` flag in DB.

#### [MODIFY] [route.ts](file:///c:/projects/vfc-fs/src/app/api/auth/zalo/callback/route.ts)
- Update to use `ZaloTokenManager.getInstance().exchangeAuthorizationCode(code)` for code reuse and clean architecture.

---

## Verification Plan

### Automated Tests
- Run `npx tsc --noEmit` to verify type safety.
- Run `npm run build` to verify Next.js build compilation.

### Manual Verification
- Access `/admin/settings` as Admin user.
- Verify left sidebar contains "Cài đặt" item.
- Test entering an `authorization_code` and clicking "Kích hoạt Chứng thực Zalo".
- Test toggling Bật / Tắt Zalo authentication and verify status updates in DB and UI.
- Verify `ZaloTokenManager` throws appropriate message when disabled or when token is missing from DB (no ENV fallback).
