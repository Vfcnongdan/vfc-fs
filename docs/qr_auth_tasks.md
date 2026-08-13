# Tasks – QR Code Nhận diện Sản phẩm Chính hãng

- `[x]` 1. Database: Thêm model `QrScanLog` vào schema.prisma + relation + migrate
- `[x]` 2. Cài thư viện `qrcode` cho generate QR
- `[x]` 3. Backend API: `GET /api/qr/[code]/route.ts` (public, tra cứu SP, ghi log, redirect)
- `[x]` 4. Backend API: `POST /api/qr/log/route.ts` (backfill userId sau login)
- `[x]` 5. Middleware: Thêm `/api/qr`, `/qr/invalid` vào PUBLIC_PATHS
- `[x]` 6. Login page: Đọc `?from=` param và redirect sau OTP verify (giữ nguyên logic cũ)
- `[x]` 7. Frontend: Trang `/qr/result/[id]/page.tsx` (banner chính hãng + chi tiết SP)
- `[x]` 8. Frontend: Trang `/qr/invalid/page.tsx` (cảnh báo QR không hợp lệ)
- `[x]` 9. Admin: Thêm nút Download QR vào bảng danh sách sản phẩm
- `[x]` 10. Verify: TypeScript check ✅ + DB push ✅
