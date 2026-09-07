---
name: vfc-clarify-requirements
description: >-
  Luôn kích hoạt khi nhận yêu cầu từ người dùng. Đánh giá xem yêu cầu có đủ
  rõ ràng để hành động hay không. Nếu mập mờ hoặc thiếu thông tin quan trọng,
  phải hỏi lại TRƯỚC KHI viết code. Không bao giờ giả định.
trigger: always_on
---

# Làm rõ yêu cầu trước khi hành động

## Nguyên tắc cốt lõi

**KHÔNG BAO GIỜ giả định khi yêu cầu mập mờ. Hỏi lại.**

Giả định sai → code sai → phải sửa lại → lãng phí thời gian cả hai bên.
Hỏi 1 câu đúng lúc tiết kiệm hơn sửa 10 file sai hướng.

## Khi nào PHẢI hỏi lại

### 1. Yêu cầu có nhiều cách hiểu
- "Sửa phần login" → Sửa UI? Sửa logic? Sửa bug cụ thể nào?
- "Thêm tính năng thông báo" → Thông báo push? In-app? Email? Cho ai?
- "Cải thiện performance" → Trang nào? Metric nào? Mức chấp nhận được?

→ **Hỏi:** "Bạn muốn cụ thể là [A], [B], hay [C]?"

### 2. Thiếu thông tin kỹ thuật quyết định thiết kế
- Không rõ data model → sẽ ảnh hưởng DB schema.
- Không rõ ai là user target → ảnh hưởng permission/routing.
- Không rõ scope → có thể over-engineer hoặc under-engineer.

→ **Hỏi** câu hỏi cụ thể về phần thiếu, đưa ra 2-3 lựa chọn nếu có thể.

### 3. Yêu cầu mâu thuẫn với code hiện tại
- User yêu cầu thêm feature nhưng architecture hiện tại không hỗ trợ.
- Yêu cầu thay đổi behavior nhưng nhiều component phụ thuộc vào behavior cũ.

→ **Nêu rõ** mâu thuẫn và hỏi hướng xử lý mong muốn.

### 4. Yêu cầu có tác động lớn không được đề cập
- Thay đổi auth flow → ảnh hưởng toàn bộ user.
- Thay đổi DB schema → cần migration.
- Xóa/đổi API → có thể break client đang dùng.

→ **Cảnh báo** tác động và xác nhận trước khi tiến hành.

## Khi nào KHÔNG cần hỏi

- Yêu cầu đã rõ ràng, chỉ có 1 cách hiểu hợp lý.
- Bug report cụ thể với steps to reproduce.
- Yêu cầu nhỏ, đơn giản, rủi ro thấp (fix typo, thêm comment, format code).
- Thông tin thiếu có thể suy ra chắc chắn từ context (code hiện tại, file đang mở, conversation trước).

## Cách hỏi hiệu quả

### ĐÚNG — Câu hỏi cụ thể, có lựa chọn:
> Bạn muốn xử lý session hết hạn bằng cách nào?
> 1. Tự động redirect về trang login
> 2. Hiện modal yêu cầu đăng nhập lại (giữ nguyên trang)
> 3. Silent refresh token ở background

### SAI — Câu hỏi mở, không giúp gì:
> "Bạn có thể mô tả thêm yêu cầu không?"

### SAI — Hỏi quá nhiều câu một lúc:
> "Bạn muốn dùng framework gì? Database gì? Deploy ở đâu? CI/CD như nào? Test strategy ra sao?"

→ Hỏi tối đa **2-3 câu** mỗi lần, ưu tiên câu hỏi **blocking** (không trả lời thì không thể tiếp tục).

## Quy trình đánh giá yêu cầu

Trước khi viết bất kỳ dòng code nào, tự hỏi:

1. **Tôi có hiểu chính xác output mong đợi không?** → Nếu không → hỏi.
2. **Có nhiều hơn 1 cách implement hợp lý không?** → Nếu có và chúng khác nhau đáng kể → hỏi.
3. **Tôi có đang giả định điều gì mà user chưa nói không?** → Nếu có và giả định đó ảnh hưởng kết quả → hỏi.
4. **Thay đổi này có side-effect nào user có thể chưa biết?** → Nếu có → cảnh báo.

Nếu cả 4 câu đều OK → tiến hành code.
