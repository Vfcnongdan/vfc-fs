# TÀI LIỆU KỊCH BẢN PHÁT HIỆN GIAN LẬN & HÀNG GIẢ QUA DỮ LIỆU QR CODE

---

## 1. Nền tảng Dữ liệu Phục vụ Nhận diện & Điều tra

Mỗi lượt quét mã QR trên hệ thống được thu thập và lưu vết với các chỉ số then chốt:

- **`code`**: Mã định danh duy nhất in trên tem QR / bao bì sản phẩm.
- **`userId` & `phone`**: Định danh người quét (nông dân, đại lý, hoặc tài khoản khả nghi).
- **`productId`**: Sản phẩm tương ứng (nếu mã QR hợp lệ trong hệ thống).
- **`success`**: Trạng thái quét (Thành công - Mã chuẩn vs. Thất bại - Mã không tồn tại / Mã rác).
- **`scanCount` & `scans [{at, ip}]`**: Lịch sử chi tiết thời gian (timestamp) và địa chỉ mạng (IP) của từng lượt quét.

---

## 2. Ma trận Kịch bản Gian lận (Fraud Detection Test Cases)

| Mã Case | Tên kịch bản | Hành vi thực tế trên thị trường (Business Context) | Dấu hiệu nhận biết trong CSDL (Data Pattern) | Mức độ rủi ro & Hành động đề xuất |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | **Sao chép mã hàng loạt (Code Cloning / Hàng giả dán tem copy)** | Kẻ gian mua 1 sản phẩm thật, sao chép mã QR thật in hàng loạt lên bao bì/chai thuốc giả rồi phân phối ra thị trường. | Cùng 1 `code` xuất hiện tại nhiều bản ghi với các `userId` khác nhau, nhiều dải `ip` từ các khu vực địa lý khác nhau, tổng `scanCount` tăng vọt bất thường. | 🔴 **Cực kỳ nguy hiểm**<br>• Tự động khóa mã tem trên hệ thống.<br>• Hiển thị cảnh báo cho người quét: *"Tem đã bị quét vượt quá giới hạn, nghi vấn hàng nhái"*. <br>• Phát tín hiệu cảnh báo đến đội Sales/MDO khu vực. |
| **TC-02** | **Quét lén / Trục lợi khuyến mại (Agent Code Hoarding)** | Đại lý/gian thương tự ý cào và quét mã QR trước khi giao hàng cho nông dân để gom điểm thưởng / tích lũy quà. | 1 `userId` quét liên tục hàng chục `productId` khác nhau chỉ trong vài phút tại cùng 1 vị trí `ip` (thường xảy ra vào khung giờ đóng cửa hoặc trong kho hàng). | 🟠 **Rủi ro cao**<br>• Tạm giữ điểm thưởng/quyền lợi tích lũy.<br>• Gắn cờ tài khoản để MDO kiểm tra thực địa tại đại lý. |
| **TC-03** | **Dò mã tự động / Tấn công thử sai (Brute-force Code Guessing)** | Kẻ xấu dùng bot hoặc thuật toán sinh mã ngẫu nhiên để tìm quy luật mã QR hợp lệ nhằm trục lợi hoặc làm giả tem. | 1 `userId` hoặc 1 địa chỉ `ip` ghi nhận tỉ lệ `success = false` đột biến (quét lỗi liên tục 10–20 mã trong khoảng thời gian ngắn). | 🔴 **Tấn công hệ thống**<br>• Tự động block tạm thời IP / User ID.<br>• Yêu cầu xác thực Captcha / OTP.<br>• Báo động bộ phận an ninh IT. |
| **TC-04** | **Khoảng cách quét bất khả thi (Impossible Travel)** | Tem sản phẩm thật được quét tại một tỉnh, nhưng một bản sao của nó lại được quét ở tỉnh khác cách hàng trăm km trong thời gian không tưởng. | Cùng 1 `code` có 2 lượt quét kế tiếp cách nhau thời gian quá ngắn so với khoảng cách địa lý giữa 2 địa chỉ `ip` (Ví dụ: Cần Thơ lúc 09:00 và Hải Phòng lúc 09:30). | 🔴 **Hàng giả phân tán**<br>• Xác định ngay khu vực có nguy cơ tuồn hàng giả gắn tem copy.<br>• Kích hoạt điều tra chuỗi phân phối. |
| **TC-05** | **Tái sinh vỏ bao bì (Replay Attack / Vỏ chai tái chế)** | Cơ sở làm giả thu mua vỏ bao bì/chai lọ chính hãng đã qua sử dụng, đóng chế phẩm giả vào rồi bán lại. | Cùng 1 `code` có lượt quét đầu tiên cách lượt quét tiếp theo từ 6 đến 12 tháng (vượt quá vòng đời sử dụng thông thường của 1 vụ mùa). | 🟡 **Rủi ro trung bình**<br>• Cảnh báo người dùng về nguy cơ bao bì cũ bị tái sử dụng trái phép.<br>• Khuyến cáo kiểm tra kỹ dấu hiệu niêm phong nắp chai. |

---

## 3. Lập luận Hiệu quả Chi phí & Giá trị mang lại cho Doanh nghiệp

1. **Tối ưu Hiệu năng & Tốc độ Xử lý**:
   - Việc phân tách rõ ràng các trường `productId`, `code`, `userId` kết hợp Indexing trong CSDL cho phép hệ thống truy vấn và phát hiện bất thường trong **vài phần nghìn giây (ms)**, không gây nghẽn database hay ảnh hưởng đến trải nghiệm người dùng cuối.
   
2. **Chi phí Lưu trữ Cực kỳ Thấp (Storage Cost)**:
   - Giả định hệ thống đạt **1.000.000 lượt quét/năm**: Toàn bộ bảng log chỉ chiếm khoảng **150MB - 300MB**.
   - Chi phí hạ tầng CSDL cho dung lượng này trên bất kỳ nền tảng Cloud nào (AWS, PostgreSQL, Supabase...) là **gần như bằng 0 (chưa đến vài nghìn VNĐ/tháng)**.

3. **Giá trị Kinh tế & Bảo vệ Thương hiệu**:
   - Dữ liệu truy vết giúp phát hiện sớm các đường dây làm giả thuốc bảo vệ thực vật / phân bón, bảo vệ uy tín thương hiệu trị giá hàng tỷ đồng của VFC và ngăn chặn thiệt hại mùa màng cho người nông dân.
