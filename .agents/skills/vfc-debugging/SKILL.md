---
name: vfc-debugging
description: >-
  Kỹ năng debug cho dự án VFC. Sử dụng khi cần điều tra bug, trace lỗi, hoặc
  phân tích hành vi không mong muốn trong ứng dụng. Hướng dẫn cách xác định
  root cause chính xác, tránh giải thích lan man về side-effect.
---

# VFC Debugging Skill

## Nguyên tắc tối thượng

**Tìm ROOT CAUSE, không mô tả SYMPTOM.**

Khi người dùng báo bug, output của bạn phải trả lời được câu hỏi:
> "Dòng code nào, ở file nào, làm sai điều gì, khiến hiện tượng xảy ra?"

## Quy trình debug

### 1. Thu thập hiện tượng
- Lắng nghe mô tả từ người dùng: "khi nào xảy ra", "thấy gì", "mong đợi gì".
- KHÔNG vội đoán nguyên nhân.

### 2. Trace ngược từ hiện tượng
- Xác định đoạn code **trực tiếp render/gây ra** hiện tượng (ví dụ: component nào hiện loading overlay).
- Từ đó trace ngược: state nào điều khiển nó → logic nào set state đó → data nào quyết định logic đó.

### 3. Xác định root cause
Root cause là **dòng code sai** hoặc **logic thiếu** khiến hệ thống rơi vào trạng thái không mong muốn. Cụ thể:
- Thiếu cleanup (ví dụ: xóa cookie nhưng quên xóa localStorage).
- Logic phân nhánh sai (ví dụ: middleware check JWT signature nhưng API check sessionToken DB → lệch nhau).
- Race condition giữa các component gọi cùng API.
- Thiếu fallback/timeout cho async operations.

### 4. Trình bày kết quả

**ĐÚNG — Ngắn gọn, chỉ thẳng root cause:**
> `/api/auth/me` trả 401 kèm `Set-Cookie` xóa cookie, nhưng **không xóa `localStorage.vfc_token`**. Khi redirect về trang login, `getMe()` đọc token cũ từ localStorage → gửi lên NestJS server → nhận `success: true` → redirect lại `/farmer` → vòng lặp vô tận.
>
> **Fix:** Gọi `removeStoredToken()` (xóa cả cookie + localStorage) ở mọi nơi xử lý 401.

**SAI — Mô tả dài dòng từng bước effect:**
> "Bước 1: Component mount... Bước 2: useEffect chạy... Bước 3: fetch được gọi... Bước 4: response trả về..." — Đây là mô tả flow, KHÔNG phải debug. Người dùng đã biết flow, họ cần biết flow **sai ở đâu**.

### 5. Nguyên tắc trình bày
- **Tối đa 3-5 câu** cho root cause explanation.
- **Dẫn link trực tiếp** tới dòng code gây lỗi.
- **Không liệt kê "nguyên nhân có thể"** trừ khi thực sự chưa xác định được. Nếu có thể xác minh bằng cách đọc code, hãy đọc rồi kết luận.
- **Phân biệt rõ**: root cause (nguyên nhân gốc) vs. contributing factor (yếu tố phụ). Chỉ nêu root cause trước, contributing factors nếu cần thì để phần phụ.

## Các pattern lỗi phổ biến trong VFC

### Auth state không đồng bộ
- VFC lưu auth token ở **3 nơi**: cookie (`vfc_token`), localStorage (`vfc_token`), và DB (`user.sessionToken`).
- Khi invalidate session, phải xóa **cả 3**. Dùng `removeStoredToken()` từ `@/lib/auth-client` để xóa cookie + localStorage.
- Middleware (`src/middleware.ts`) chỉ verify JWT signature, KHÔNG query DB. API routes (`/api/auth/me`) verify cả DB sessionToken. → Hai tầng này có thể lệch nhau.

### Redirect loop
- Nếu component trong `/farmer` hoặc `/admin` detect 401 và redirect về `/`, phải clear toàn bộ auth state TRƯỚC KHI redirect.
- Trang login (`/`) có `checkingSession` state mặc định = `true`. Nếu `getMe()` trả `success: true` (do token cũ trong localStorage), nó sẽ `router.push("/farmer")` → lại bị 401 → redirect về `/` → loop.

### Single Active Session
- Hệ thống chỉ cho phép 1 session active. Đăng nhập ở thiết bị mới → `sessionToken` trong DB thay đổi → token cũ ở thiết bị khác bị invalidate ở tầng DB (nhưng JWT signature vẫn valid).
