# Kế hoạch: Nhận diện Sản phẩm Chính hãng qua QR Code

## Mô tả User Story
Nông dân nhận sản phẩm có QR code trên vỏ chai → quét bằng điện thoại → được đưa tới trang chi tiết sản phẩm kèm dòng chữ xác nhận hàng chính hãng. Hệ thống cũng ghi nhận lượt quét thành công/thất bại để thống kê.

## Open Questions

> [!IMPORTANT]
> ### 1. Nội dung QR Code – Mỗi sản phẩm 1 QR hay mỗi **chai** 1 QR?
> - **Option A**: Mỗi **sản phẩm (SKU)** có 1 QR duy nhất. QR dẫn tới `/qr/{productId}`. Ai quét cũng thấy cùng trang. Đơn giản, phù hợp giai đoạn đầu.
> - **Option B**: Mỗi **chai riêng lẻ** có 1 serial code riêng. QR dẫn tới `/qr/{serialCode}`. Cho phép phát hiện hàng giả (serial đã quét quá nhiều lần). Phức tạp hơn, cần tạo & in serial cho từng chai.
>
> Tôi đang nghiêng về **Option A** cho giai đoạn đầu vì đỡ phức tạp. Bạn muốn chọn phương án nào?

> [!IMPORTANT]
> ### 2. URL format cho QR
> QR code sẽ encode URL đầy đủ (VD: `https://your-domain.com/qr/cmp87snm70000weyry85rmnk1`). Khi user quét bằng camera điện thoại, trình duyệt sẽ mở URL này.
>
> Bạn muốn dùng domain production nào trong nội dung QR? (VD: `https://vfc-fs.vercel.app` hoặc domain riêng?)

> [!IMPORTANT]
> ### 3. Trang đăng nhập – redirect back
> Hiện tại trang login (`page.tsx`) sau khi OTP thành công luôn hardcode `router.push("/farmer")`, **không đọc query param `?from=`** để redirect về trang trước đó.
>
> Để hỗ trợ flow "quét QR → chưa đăng nhập → đăng nhập → quay về trang sản phẩm", tôi cần sửa trang login để đọc `?from=` param. **Bạn đồng ý chỉnh login flow này không?**

> [!NOTE]
> ### 4. Admin Download QR – Format
> Tôi dự định tạo QR dưới dạng hình PNG có thể download riêng từng sản phẩm ngay trong bảng danh sách Admin. Nếu cần bulk download (tải tất cả QR cùng lúc), xin cho biết thêm.

---

## Proposed Changes

### 1. Database – Migration mới

#### [NEW] Thêm model `QrScanLog` vào [schema.prisma](file:///c:/projects/vfc-fs/prisma/schema.prisma)

Thiết kế gom lượt quét theo **user + sản phẩm** thành 1 record, dùng `Json[]` array lưu danh sách lần quét để tránh phình to record:

```prisma
model QrScanLog {
  id          String   @id @default(cuid())
  userId      String?  @map("user_id")           // null nếu quét khi chưa đăng nhập
  productId   String?  @map("product_id")         // null nếu quét QR không hợp lệ
  scanCount   Int      @default(1) @map("scan_count")
  lastScannedAt DateTime @default(now()) @map("last_scanned_at")
  scans       Json     @default("[]")             // Array of { at: ISO string, success: boolean, ip?: string }
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user    User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  product Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@unique([userId, productId])   // Mỗi user+product 1 record, gom các lần quét vào mảng scans
  @@index([productId])
  @@map("qr_scan_logs")
}
```

**Chống spam**: Khi user quét lại cùng sản phẩm, chỉ append 1 entry mới vào mảng `scans` và tăng `scanCount`. Có thêm rate-limit: nếu `lastScannedAt` < 30 giây thì bỏ qua (không ghi log).

---

### 2. Backend API

#### [NEW] `src/app/api/qr/[code]/route.ts`
- Route **public** (thêm vào `PUBLIC_PATHS` trong middleware).
- Nhận `code` = productId hoặc slug.
- Tra cứu sản phẩm trong DB.
- Nếu tìm thấy → ghi `QrScanLog` (success) → redirect 307 tới `/qr/result/{productId}`.
- Nếu không tìm thấy → ghi `QrScanLog` (failed, productId=null) → redirect tới `/qr/invalid`.

#### [NEW] `src/app/api/qr/log/route.ts`
- Endpoint cho frontend gọi sau khi user đã đăng nhập để **backfill** userId vào log đã tạo khi chưa đăng nhập.

---

### 3. Frontend – Trang kết quả quét QR

#### [NEW] `src/app/qr/result/[id]/page.tsx`
- Trang **protected** (yêu cầu đăng nhập, nếu chưa → redirect login với `?from=/qr/result/{id}`).
- Hiển thị thông tin sản phẩm chi tiết (reuse API `/api/products/[id]`).
- Có thêm **banner "✅ Sản phẩm chính hãng VFC"** nổi bật phía trên.
- Có nút "Thêm vào giỏ hàng" và link "Xem tất cả sản phẩm".
- Gọi API log scan (backfill userId nếu vừa login xong).

#### [NEW] `src/app/qr/invalid/page.tsx`
- Trang thông báo QR không hợp lệ / sản phẩm không tồn tại.
- Hiển thị cảnh báo "⚠️ Mã QR không tìm thấy sản phẩm. Vui lòng liên hệ VFC."

---

### 4. Middleware Update

#### [MODIFY] [middleware.ts](file:///c:/projects/vfc-fs/src/middleware.ts)
- Thêm `/api/qr`, `/qr/invalid` vào `PUBLIC_PATHS`.
- Route `/qr/result/*` vẫn **protected** (yêu cầu đăng nhập) → middleware tự redirect về login nếu chưa auth, kèm `?from=`.

---

### 5. Login page redirect fix

#### [MODIFY] [src/app/page.tsx](file:///c:/projects/vfc-fs/src/app/page.tsx)
- Đọc `searchParams.get("from")` hoặc `localStorage.getItem("qr_redirect")`.
- Sau OTP verify thành công: nếu có `from` → `router.push(from)` thay vì luôn push `/farmer`.

---

### 6. Admin – Download QR Code

#### [MODIFY] [src/app/admin/products/page.tsx](file:///c:/projects/vfc-fs/src/app/admin/products/page.tsx)
- Thêm nút **Download QR** bên cạnh nút Edit/Delete trong bảng danh sách sản phẩm.
- Sử dụng thư viện JS (e.g. `qrcode` hoặc sinh QR bằng API) để generate hình QR từ URL `https://{domain}/qr/{productId}`.
- Download file PNG kèm tên sản phẩm.

---

### 7. QR Code Generation Library

#### [NEW] Package dependency
- Cài thêm `qrcode` (NPM package) để generate QR code phía client/server.

---

## Verification Plan

### Automated Tests
- Gọi `GET /api/qr/{productId_hợp_lệ}` → expect 307 redirect tới `/qr/result/{id}`.
- Gọi `GET /api/qr/{mã_không_tồn_tại}` → expect redirect tới `/qr/invalid`.
- Kiểm tra `QrScanLog` được tạo/update đúng sau mỗi lần quét.

### Manual Verification
1. Vào trang Admin → tìm sản phẩm → nhấn "Download QR" → nhận file PNG.
2. Quét QR bằng camera điện thoại (hoặc mở URL trực tiếp).
3. Nếu đã đăng nhập → hiện trang chi tiết sản phẩm kèm banner chính hãng.
4. Nếu chưa đăng nhập → chuyển tới login → đăng nhập → tự động về trang sản phẩm.
5. Quét QR không hợp lệ → hiện trang cảnh báo.
6. Kiểm tra DB: `qr_scan_logs` ghi nhận đúng userId, productId, mảng scans.
