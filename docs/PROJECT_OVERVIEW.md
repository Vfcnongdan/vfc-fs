# VFC Farmer Success — Tổng quan dự án

> Tài liệu mô tả kiến trúc, nghiệp vụ và cấu trúc codebase của dự án **vfc-farmer-success** (VFC FS).

---

## 1. Giới thiệu

**VFC Farmer Success** là nền tảng web hỗ trợ nông dân Việt Nam trong hệ sinh thái VFC (Vietnam Fertilizer Corporation). Ứng dụng tập trung vào:

- **Chẩn đoán bệnh cây trồng bằng AI** — chụp ảnh, phân tích và gợi ý sản phẩm VFC phù hợp
- **Quản lý cây trồng cá nhân** — nông dân chọn loại cây để nhận thông tin liên quan
- **Đặt hàng B2C** — mua sản phẩm qua đại lý gần nhất
- **Quản lý kho & đơn hàng** — dành cho đại lý (Agency) và nhân viên bán hàng
- **Quản trị hệ thống** — admin quản lý user, sản phẩm, dữ liệu huấn luyện AI

Slogan thương hiệu: **"Giá trị đích thực"**.

---

## 2. Tech Stack

| Thành phần | Công nghệ |
|------------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Ngôn ngữ | TypeScript 5 |
| ORM / DB | Prisma 7 + PostgreSQL 16 |
| Connection pool | PgBouncer (Docker) |
| Auth | JWT (jose), OTP qua Zalo/Telegram |
| State (client) | Zustand |
| Validation | Zod |
| AI | Google Gemini, Groq, OpenRouter (vision) |
| Image processing | Sharp |
| Icons | Lucide React |
| Toast | react-hot-toast |

---

## 3. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                        │
│  /farmer  /admin  /agent  /sale  — React Client Components  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Next.js Middleware (src/middleware.ts)         │
│  JWT cookie → verify → role-based route protection          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   API Routes (src/app/api/)                 │
│  auth, diagnoses, b2c/orders, admin/*, farmer/*, agent/*   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Business Logic (src/lib/, src/services/)       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Prisma ORM → PostgreSQL (PgBouncer)            │
└─────────────────────────────────────────────────────────────┘
```

### Luồng xác thực

1. Người dùng nhập SĐT tại `/` → gửi OTP (`POST /api/auth/otp/send`)
2. Xác thực OTP (`POST /api/auth/otp/verify`) → tạo/cập nhật `User`, gắn JWT vào cookie `vfc_token`
3. Middleware đọc cookie, verify JWT, inject headers `x-user-id`, `x-user-role`, `x-user-phone`
4. Route handler dùng `getRequestUser()` từ headers

**Lưu ý:** Chỉ SĐT có trong whitelist (bảng `farmers`, `agencies`, `mdo`, `se`, hoặc `users`) mới đăng nhập được. SĐT lạ trả về `PHONE_NOT_AUTHORIZED`.

---

## 4. Vai trò người dùng (Roles)

| Role | Mô tả | Portal chính |
|------|-------|--------------|
| `FARMER` | Nông dân | `/farmer` |
| `AGENCY` | Đại lý | `/agent`, `/admin/orders` |
| `SUPER_AGENT` | Siêu đại lý | `/agent`, `/admin/orders` |
| `SALE` | Nhân viên bán hàng | `/sale` |
| `MDO` | Market Development Officer | `/admin/orders`, duyệt đổi cây trồng |
| `SE` | Sales Executive | `/admin/orders` |
| `ADMIN` | Quản trị viên | `/admin/*` |
| `BGD` | Ban giám đốc (định nghĩa trong schema) | — |

### Phân quyền route (middleware)

| Prefix | Roles được phép |
|--------|-----------------|
| `/api/admin` | ADMIN |
| `/admin/products`, `/admin/system` | ADMIN |
| `/admin/orders` | ADMIN, AGENCY, SUPER_AGENT, MDO, SE |
| `/sale`, `/api/sale` | SALE, ADMIN |
| `/agent`, `/api/agent` | SUPER_AGENT, AGENCY, ADMIN |

Route công khai: `/`, `/assets`, `/api/auth/otp/send`, `/api/auth/otp/verify`.

---

## 5. Các module nghiệp vụ chính

### 5.1. Portal Nông dân (`/farmer`)

| Trang | Chức năng |
|-------|-----------|
| `/farmer` | Trang chủ — chào user, cây trồng, shortcut chẩn đoán/đơn hàng/bản đồ |
| `/farmer/diagnose` | Chụp/tải ảnh → AI chẩn đoán bệnh → gợi ý sản phẩm |
| `/farmer/crops/select` | Chọn/cập nhật loại cây trồng (có workflow duyệt qua MDO) |
| `/farmer/products` | Danh sách sản phẩm, mua hàng |
| `/farmer/cart` | Giỏ hàng |
| `/farmer/orders` | Lịch sử đơn hàng B2C |
| `/farmer/orders/[id]` | Chi tiết đơn hàng |

**Tính năng bổ sung:**
- `WeatherBadge` — hiển thị thời tiết theo vị trí
- `ZaloFloatingButton` — liên hệ Zalo
- Link bản đồ ngoài: `https://map.vfcnongdan.com/`

### 5.2. Chẩn đoán AI (`src/lib/aiDiagnosis.ts`)

Luồng xử lý:

1. **Validate ảnh** — kiểm tra có phải cây trồng, đúng loại cây, đủ rõ không (Groq vision)
2. **Tra cứu reference** — dữ liệu `PlanStageDisease` (cây × giai đoạn × sâu bệnh × mức độ)
3. **Gọi AI chẩn đoán** — fallback chain: Gemini → Groq → OpenRouter
4. **Gợi ý sản phẩm** — map với catalog sản phẩm VFC
5. Lưu kết quả vào `PlantDiagnosis` + `DiagnosisSuggestion`

Trạng thái chẩn đoán: `PROCESSING` | `DONE` | `FAILED`.

Admin có thể quản lý dữ liệu huấn luyện tại `/admin/ai-training` (CRUD + import CSV).

### 5.3. Đặt hàng B2C

- Nông dân chọn **đại lý gần nhất** (geo query với `earth_distance` trong Postgres)
- Xem catalog sản phẩm của đại lý (`/api/farmer/agencies/[id]/catalog`)
- Tạo đơn `B2cOrder` — buyer = farmer, seller = agency user
- Trạng thái đơn: `PENDING` → `CONFIRMED` → `SHIPPING` → `DELIVERED` / `CANCELLED`
- Thông báo realtime qua bảng `Notification`

### 5.4. Portal Đại lý (`/agent`)

| Trang | Chức năng |
|-------|-----------|
| `/agent/inventory` | Quản lý tồn kho sản phẩm |
| `/agent/orders` | Xem & xử lý đơn hàng từ nông dân |

Layout responsive: sidebar desktop + bottom nav mobile.

### 5.5. Portal Admin (`/admin`)

| Trang | Chức năng |
|-------|-----------|
| `/admin` | Dashboard — shortcut theo role |
| `/admin/system/users` | Quản lý người dùng |
| `/admin/products` | Quản lý sản phẩm |
| `/admin/orders` | Quản lý đơn hàng (multi-role) |
| `/admin/ai-training` | Quản lý dữ liệu PlanStageDisease |
| `/admin/crop-change-requests` | Duyệt yêu cầu đổi cây trồng |

### 5.6. Portal Sale (`/sale`)

Dành cho nhân viên bán hàng — xem đơn hàng và dashboard riêng.

### 5.7. Yêu cầu đổi cây trồng

- **FARMER** muốn đổi cây → tạo `CropChangeRequest` → MDO phụ trách duyệt
- Các role khác (AGENCY, SE, MDO...) có thể đổi trực tiếp không cần duyệt
- Reviewer được xác định qua trường `mdo` trong bảng `farmers`

---

## 6. Mô hình dữ liệu (Prisma)

### Nhóm User & Profile

- `User` — tài khoản chung (phone, role, sessionToken, hierarchy parent/children)
- `UserProfile` — cropIds, address, notes
- `Farmer`, `Agency`, `Mdo`, `Se` — master data liên kết với User qua `userId`
- `SaleProfile` — thông tin vùng của nhân viên sale

### Nhóm Sản phẩm

- `Category`, `Product`, `ProductDetail` — catalog sản phẩm VFC
- `Inventory` — tồn kho theo owner (agency)

### Nhóm Chẩn đoán

- `Crop` — danh mục cây trồng (~34 loại)
- `PlanStageDisease` — dữ liệu tham chiếu AI (cây × giai đoạn × sâu bệnh)
- `PlantDiagnosis`, `DiagnosisSuggestion` — lịch sử chẩn đoán + gợi ý sản phẩm

### Nhóm Đơn hàng

- `B2cOrder`, `B2cOrderItem` — đơn nông dân → đại lý
- `B2bOrder`, `B2bOrderItem` — đơn B2B (schema có, ít UI hơn)

### Nhóm Hỗ trợ

- `OtpRequest` — lưu OTP, expiry, attempts
- `Notification` — thông báo đơn hàng, duyệt cây trồng
- `CropChangeRequest` — workflow duyệt đổi cây
- `ChatMessage` — tin nhắn (schema có, chưa phát triển đầy đủ UI)

---

## 7. API Endpoints

### Auth
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/auth/otp/send` | Gửi OTP |
| POST | `/api/auth/otp/verify` | Xác thực OTP, set cookie |
| GET | `/api/auth/me` | Thông tin user hiện tại |
| POST | `/api/auth/logout` | Đăng xuất |

### Farmer
| Method | Path | Mô tả |
|--------|------|-------|
| GET/PUT | `/api/farmer/crops` | Cây trồng của user |
| GET | `/api/farmer/agencies` | Đại lý gần nhất (geo) |
| GET | `/api/farmer/agencies/[id]/catalog` | Catalog sản phẩm đại lý |

### Chẩn đoán
| Method | Path | Mô tả |
|--------|------|-------|
| GET/POST | `/api/diagnoses` | Danh sách / tạo chẩn đoán |
| GET/PATCH | `/api/diagnoses/[id]` | Chi tiết / cập nhật |

### Đơn hàng B2C
| Method | Path | Mô tả |
|--------|------|-------|
| GET/POST | `/api/b2c/orders` | Danh sách / tạo đơn |
| GET/PATCH | `/api/b2c/orders/[id]` | Chi tiết / cập nhật trạng thái |

### Admin
| Method | Path | Mô tả |
|--------|------|-------|
| GET/POST | `/api/admin/users` | Quản lý user |
| GET/PATCH/DELETE | `/api/admin/users/[id]` | CRUD user |
| GET/POST | `/api/admin/products` | Quản lý sản phẩm |
| GET/PATCH/DELETE | `/api/admin/products/[id]` | CRUD sản phẩm |
| GET/POST | `/api/admin/ai-training` | Dữ liệu AI training |
| POST | `/api/admin/ai-training/import` | Import CSV |

### Agent
| Method | Path | Mô tả |
|--------|------|-------|
| GET/PUT | `/api/agent/inventory` | Quản lý tồn kho |

### Khác
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/products` | Danh sách sản phẩm |
| GET | `/api/crops` | Danh sách cây trồng |
| GET/POST | `/api/crop-change-requests` | Yêu cầu đổi cây |
| GET/PATCH | `/api/notifications` | Thông báo |
| GET | `/api/zalo-contact` | Thông tin liên hệ Zalo |

---

## 8. Cấu trúc thư mục

```
vfc-fs/
├── document/                  # Tài liệu dự án
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Seed crops, products, agencies...
│   ├── seed-mdo.ts            # Seed MDO
│   ├── seed-se.ts             # Seed SE
│   └── plan-stage-disease-seed-data.ts
├── public/
│   └── assets/images/         # Logo, banner, icons
├── scripts/
│   ├── init.sql               # Postgres extensions (earthdistance)
│   └── update-prices.ts
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── page.tsx           # Login (OTP)
│   │   ├── farmer/            # Portal nông dân
│   │   ├── admin/             # Portal admin
│   │   ├── agent/             # Portal đại lý
│   │   ├── sale/              # Portal sale
│   │   └── api/               # API routes
│   ├── components/            # UI components dùng chung
│   ├── controllers/           # OTP controller
│   ├── lib/                   # Business logic, auth, utils
│   ├── services/              # OTP services, agency, product cache
│   ├── store/                 # Zustand stores (cart, crop)
│   └── middleware.ts          # Auth & RBAC middleware
├── docker-compose.yml         # PostgreSQL + PgBouncer
├── package.json
└── next.config.ts
```

---

## 9. Biến môi trường

| Biến | Mục đích |
|------|----------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `JWT_SECRET` | Secret ký JWT session |
| `GEMINI_API_KEY` | Google Gemini AI |
| `GEMINI_MODEL` | Model Gemini (default: gemini-flash-latest) |
| `GROQ_API_KEY` | Groq vision API |
| `GROQ_API_KEY_PLAN_VALIDATION` | Groq cho validate ảnh |
| `GROQ_VISION_MODEL` | Model Groq vision |
| `OPENROUTER_API_KEY` | OpenRouter fallback |
| `OPENROUTER_MODEL` | Model OpenRouter |
| `OTP_SERVICE_PROVIDER` | `telegram` hoặc `zalo` |
| `TELEGRAM_BOT_TOKEN` | Bot Telegram gửi OTP (dev) |
| `TELEGRAM_CHAT_ID` | Chat ID nhận OTP (dev) |
| `ZALO_OA_TOKEN` | Zalo OA token (production) |
| `NEXT_PUBLIC_BASE_URL` | Base URL cho OpenRouter referer |
| `POSTGRES_USER/PASSWORD/DB` | Docker Postgres config |

---

## 10. Hướng dẫn chạy dự án

### Yêu cầu
- Node.js 20+
- Docker & Docker Compose

### Khởi động

```bash
# 1. Khởi động database
docker-compose up -d

# 2. Đồng bộ schema & seed dữ liệu
npx prisma db push
npx prisma db seed

# 3. Chạy dev server
npm run dev
```

Truy cập: [http://localhost:3000](http://localhost:3000)

### Scripts npm

| Script | Mô tả |
|--------|-------|
| `npm run dev` | Dev server (webpack) |
| `npm run build` | Build production |
| `npm run start` | Chạy production |
| `npm run lint` | ESLint |

---

## 11. OTP Service

Hệ thống OTP hỗ trợ 2 provider (Strategy pattern):

- **TelegramOtpService** — dùng cho development (gửi OTP vào Telegram chat)
- **ZaloOtpService** — dùng cho production (Zalo OA)

Chọn provider qua `OTP_SERVICE_PROVIDER`. OTP 4 chữ số, có expiry và giới hạn attempts.

---

## 12. State Management (Client)

| Store | File | Mục đích |
|-------|------|----------|
| Cart | `src/store/useCartStore.ts` | Giỏ hàng mua sản phẩm |
| Crop | `src/store/useCropStore.ts` | Cây trồng của user |

---

## 13. Components quan trọng

| Component | Mô tả |
|-----------|-------|
| `FarmerHeader` | Header portal nông dân |
| `NotificationBell` | Chuông thông báo |
| `WeatherBadge` | Badge thời tiết |
| `CartButton` | Nút giỏ hàng |
| `ProductMultiSelect` | Chọn nhiều sản phẩm |
| `PageLoadingOverlay` | Overlay loading |
| `ZaloFloatingButton` | Nút Zalo floating |
| `LogoutButton` | Đăng xuất |
| `ToastProvider` | Toast notifications |

---

## 14. Ghi chú kỹ thuật

1. **Prisma adapter:** Dùng `@prisma/adapter-pg` với `pg` Pool thay vì driver mặc định
2. **Geo query:** Postgres extension `earthdistance` + `cube` (init trong `scripts/init.sql`)
3. **Raw SQL:** `$queryRaw` dùng ở `agencyService.ts` cho tính khoảng cách — tham số được bind an toàn
4. **Session:** JWT 7 ngày + `sessionToken` UUID trên User để invalidate session
5. **Image:** Remote images từ Google Drive (`lh3.googleusercontent.com`)
6. **Phone:** Chuẩn hóa SĐT Việt Nam qua `src/lib/phone.ts` (variants 0xxx/84xxx)

---

## 15. Roadmap / Phần chưa hoàn thiện

- Chat messaging (`ChatMessage` model có nhưng UI chưa đầy đủ)
- B2B orders — schema có, UI hạn chế
- Role `BGD` — định nghĩa trong enum, chưa có portal riêng
- `/agent/profile` — được reference trong nav nhưng chưa có page

---

*Tài liệu được tạo tự động từ phân tích codebase — cập nhật: 2026-07-29*
