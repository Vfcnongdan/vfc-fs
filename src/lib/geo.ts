export const provinceToRegionMap: Record<string, string> = {
  // === 1. ĐỒNG BẰNG SÔNG CỬU LONG (MIỀN TÂY) ===
  "Cần Thơ": "ĐBSCL",       // Sáp nhập: Cần Thơ + Sóc Trăng + Hậu Giang
  "An Giang": "ĐBSCL",      // Sáp nhập: An Giang + Kiên Giang
  "Vĩnh Long": "ĐBSCL",     // Sáp nhập: Vĩnh Long + Bến Tre + Trà Vinh
  "Đồng Tháp": "ĐBSCL",     // Sáp nhập: Đồng Tháp + Tiền Giang
  "Cà Mau": "ĐBSCL",        // Sáp nhập: Cà Mau + Bạc Liêu

  // === 2. TÂY NGUYÊN ===
  "Lâm Đồng": "Tây Nguyên",   // Sáp nhập: Lâm Đồng + Đắk Nông + Bình Thuận (mở rộng xuống biển)
  "Đắk Lắk": "Tây Nguyên",    // Sáp nhập: Đắk Lắk + Phú Yên
  "Kon Tum": "Tây Nguyên",    // Giữ nguyên, không sáp nhập

  // === 3. ĐÔNG NAM BỘ (MIỀN ĐÔNG) ===
  "Hồ Chí Minh": "Đông Nam Bộ", // Siêu đô thị sáp nhập: TP.HCM + Bình Dương + Bà Rịa - Vũng Tàu
  "Đồng Nai": "Đông Nam Bộ",    // Sáp nhập: Đồng Nai + Bình Phước
  "Tây Ninh": "Đông Nam Bộ",    // Sáp nhập: Tây Ninh + Long An

  // === 4. MIỀN TRUNG (BẮC TRUNG BỘ & DUYÊN HẢI MIỀN TRUNG) ===
  "Huế": "Miền Trung",          // Thành phố Huế trực thuộc TW mới (giữ nguyên địa giới)
  "Đà Nẵng": "Miền Trung",      // Sáp nhập: TP. Đà Nẵng + Quảng Nam
  "Gia Lai": "Miền Trung",      // Sáp nhập: Gia Lai + Bình Định
  "Khánh Hòa": "Miền Trung",    // Sáp nhập: Khánh Hòa + Ninh Thuận
  "Quảng Ngãi": "Miền Trung",   // Sáp nhập: Quảng Ngãi + Kon Tum
  "Quảng Trị": "Miền Trung",    // Sáp nhập: Quảng Trị + Quảng Bình
  "Thanh Hóa": "Miền Trung",    // Giữ nguyên
  "Nghệ An": "Miền Trung",      // Giữ nguyên
  "Hà Tĩnh": "Miền Trung",      // Giữ nguyên

  // === 5. TRUNG DU VÀ MIỀN NÚI PHÍA BẮC ===
  "Thái Nguyên": "Miền Bắc", // Sáp nhập: Thái Nguyên + Bắc Kạn
  "Tuyên Quang": "Miền Bắc", // Sáp nhập: Tuyên Quang + Hà Giang
  "Lào Cai": "Miền Bắc",     // Sáp nhập: Lào Cai + Yên Bái
  "Phú Thọ": "Miền Bắc",     // Siêu tỉnh sáp nhập: Phú Thọ + Vĩnh Phúc + Hòa Bình
  "Cao Bằng": "Miền Bắc",    // Giữ nguyên
  "Lạng Sơn": "Miền Bắc",    // Giữ nguyên
  "Lai Châu": "Miền Bắc",    // Giữ nguyên
  "Điện Biên": "Miền Bắc",   // Giữ nguyên
  "Sơn La": "Miền Bắc",      // Giữ nguyên

  // === 6. ĐỒNG BẰNG SÔNG HỒNG ===
  "Hà Nội": "Miền Bắc",     // Thủ đô Hà Nội (giữ nguyên)
  "Hải Phòng": "Miền Bắc",  // Sáp nhập: TP. Hải Phòng + Hải Dương
  "Bắc Ninh": "Miền Bắc",   // Sáp nhập: Bắc Ninh + Bắc Giang
  "Hưng Yên": "Miền Bắc",   // Sáp nhập: Hưng Yên + Thái Bình
  "Ninh Bình": "Miền Bắc",  // Sáp nhập: Ninh Bình + Hà Nam + Nam Định
  "Quảng Ninh": "Miền Bắc"  // Giữ nguyên
};