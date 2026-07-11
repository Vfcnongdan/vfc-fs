
export type CropGrowthStageOptions = {
  cropType: string;
  growthStages: string[];
  pestDiseases: string[];
  severityLevels: string[];
};

export const cropGrowthStageOptions: CropGrowthStageOptions[] = [
  {
    cropType: "Bầu bí dưa",
    growthStages: ["Cây con", "Phát triển thân lá", "Cơi đọt", "Ra hoa", "Nuôi trái"],
    pestDiseases: ["Bệnh", "Sâu"],
    severityLevels: ["Không có", "Nhẹ", "Trung bình", "Nặng"],
  },
  {
    cropType: "Hoa cúc",
    growthStages: ["Ra hoa", "Cơi đọt"],
    pestDiseases: ["Sâu", "Bệnh"],
    severityLevels: ["Không có", "Nhẹ", "Trung bình", "Nặng", "Hết cứu"],
  },
  {
    cropType: "Ớt",
    growthStages: ["Cây con", "Ra hoa", "Nuôi trái"],
    pestDiseases: ["Bệnh", "Sâu"],
    severityLevels: ["Không có", "Nhẹ", "Trung bình", "Nặng"],
  },
  {
    cropType: "Cà chua",
    growthStages: ["Cây con", "Nuôi trái", "Phát triển thân lá"],
    pestDiseases: ["Bệnh", "Sâu"],
    severityLevels: ["Không có", "Nhẹ", "Trung bình", "Nặng", "Hết cứu"],
  },
  {
    cropType: "Bắp cải",
    growthStages: ["Phát triển thân lá"],
    pestDiseases: ["Sâu", "Bệnh"],
    severityLevels: ["Không có", "Nhẹ", "Trung bình", "Nặng", "Hết cứu"],
  },
  {
    cropType: "Cây hành",
    growthStages: ["Cây con", "Phát triển thân lá"],
    pestDiseases: ["Bệnh", "Sâu"],
    severityLevels: ["Nhẹ", "Trung bình", "Nặng", "Hết cứu"],
  },
  {
    cropType: "Sầu riêng",
    growthStages: ["Phát triển thân lá", "Sau thu hoạch", "Cơi đọt", "Ra hoa", "Nuôi trái"],
    pestDiseases: ["Bệnh", "Sâu"],
    severityLevels: ["Không có", "Nhẹ", "Trung bình", "Nặng"],
  },
  {
    cropType: "Lúa",
    growthStages: [
      "Xuống giống",
      "Sau thu hoạch",
      "Mạ",
      "Đẻ nhánh - làm đòng",
      "Đẻ nhánh",
      "Làm đòng - trổ",
      "Trước & sau trổ",
      "Trổ - chín",
    ],
    pestDiseases: ["Cỏ", "Sâu", "Bệnh", "Rầy"],
    severityLevels: ["Nhẹ", "Trung bình", "Nặng"],
  },
  {
    cropType: "Cà phê",
    growthStages: ["Sau thu hoạch", "Ra hoa", "Nuôi trái"],
    pestDiseases: ["Bệnh", "Sâu"],
    severityLevels: ["Không có", "Nhẹ", "Trung bình", "Nặng"],
  },
  {
    cropType: "Xoài",
    growthStages: ["Ra hoa", "Nuôi trái"],
    pestDiseases: ["Bệnh", "Sâu"],
    severityLevels: ["Không có", "Nhẹ", "Trung bình", "Nặng"],
  }
];
