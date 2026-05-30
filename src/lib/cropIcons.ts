/**
 * Maps cropCode to an emoji icon + background color.
 * cropCode is generated from the crop name (uppercase, no diacritics, spaces→underscore).
 */

interface CropIcon {
  emoji: string;
  bg: string; // tailwind-style hex or hsl
}

const CROP_ICON_MAP: Record<string, CropIcon> = {
  // Lúa
  LUA_95_100:        { emoji: "🌾", bg: "#d4a017" },
  LUA_NHAT_DS1:      { emoji: "🌾", bg: "#c8960e" },
  LUA_NEP:           { emoji: "🌾", bg: "#b88a0c" },
  // Cà phê
  CA_PHE:            { emoji: "☕", bg: "#6f4e37" },
  // Sầu riêng
  SAU_RIENGS:        { emoji: "🍈", bg: "#8a9a2a" },
  SAU_RIENG:         { emoji: "🍈", bg: "#8a9a2a" },
  SAU_RIENG_TO:      { emoji: "🌿", bg: "#5a7a1a" },
  // Xoài
  XOAI:              { emoji: "🥭", bg: "#f5a623" },
  XOAI_DL:           { emoji: "🥭", bg: "#e09010" },
  // Rau
  RAU_AN_LA:         { emoji: "🥬", bg: "#3a9e5f" },
  RAU_AN_CU:         { emoji: "🥕", bg: "#e07b39" },
  RAU_AN_TRAI:       { emoji: "🥦", bg: "#2d8a4e" },
  // Cà chua
  CA_CHUA:           { emoji: "🍅", bg: "#e03a2f" },
  // Dưa hấu
  DUA_HAU:           { emoji: "🍉", bg: "#c0392b" },
  // Hoa cúc
  HOA_CUC:           { emoji: "🌼", bg: "#f1c40f" },
  // Bắp cải
  BAP_CAI:           { emoji: "🥬", bg: "#27ae60" },
  // Cam
  CAM:               { emoji: "🍊", bg: "#e67e22" },
  // Chanh
  CHANH:             { emoji: "🍋", bg: "#f9ca24" },
  // Chuối
  CHUOI:             { emoji: "🍌", bg: "#f0c30f" },
  // Có múi
  CO_MUI:            { emoji: "🍋", bg: "#e8b820" },
  // Đậu
  DAU:               { emoji: "🫘", bg: "#8b6914" },
  // Dâu tây
  DAU_TAY:           { emoji: "🍓", bg: "#e74c3c" },
  // Điều
  DIEU:              { emoji: "🌰", bg: "#c0392b" },
  // Dứa
  DUA:               { emoji: "🍍", bg: "#f39c12" },
  // Hành
  HANH:              { emoji: "🧅", bg: "#9b59b6" },
  // Hồ tiêu
  HO_TIEU:           { emoji: "🌶️", bg: "#c0392b" },
  // Khoai tây
  KHOAI_TAY:         { emoji: "🥔", bg: "#d4a574" },
  // Mận
  MAN:               { emoji: "🍑", bg: "#8e44ad" },
  // Nhãn
  NHAN:              { emoji: "🍇", bg: "#8e44ad" },
  // Nho
  NHO:               { emoji: "🍇", bg: "#6c3483" },
  // Ớt
  OT:                { emoji: "🌶️", bg: "#e74c3c" },
  // Quýt
  QUYT:              { emoji: "🍊", bg: "#d35400" },
  // Táo
  TAO:               { emoji: "🍎", bg: "#c0392b" },
  // Thanh long
  THANH_LONG:        { emoji: "🐉", bg: "#e91e8c" },
  // Vải
  VAI:               { emoji: "🍒", bg: "#c0392b" },
};

const DEFAULT_ICON: CropIcon = { emoji: "🌱", bg: "#2d6a4f" };

export function getCropIcon(cropCode: string): CropIcon {
  // Try exact match first
  if (CROP_ICON_MAP[cropCode]) return CROP_ICON_MAP[cropCode];

  // Fuzzy: check if any key is a substring of cropCode or vice versa
  for (const [key, icon] of Object.entries(CROP_ICON_MAP)) {
    if (cropCode.includes(key) || key.includes(cropCode)) return icon;
  }

  return DEFAULT_ICON;
}
