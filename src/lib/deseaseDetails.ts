
export type CropGrowthStageOptions = {
  cropType: string;
  growthStages: string[];
  pestDiseases: string[];
  severityLevels: string[];
};

/**
 * @deprecated Dùng getCropOptionByType() từ @/lib/cropOptions thay thế.
 * Data này chỉ còn dùng làm fallback khi file public/crop-options.json chưa tồn tại.
 * Để cập nhật, bấm nút "Đồng bộ cấu hình cây trồng" trên trang AI Training.
 */
export const cropGrowthStageOptions: CropGrowthStageOptions[] = [
  {
    "cropType": "Sầu riêng",
    "growthStages": [
      "Sau thu hoạch",
      "Cơi đọt",
      "Phát triển thân lá",
      "Ra hoa",
      "Nuôi trái"
    ],
    "pestDiseases": [
      "Sâu",
      "Bệnh"
    ],
    "severityLevels": [
      "Trung bình",
      "Nặng",
      "Không có",
      "Nhẹ"
    ]
  },
  {
    "cropType": "Hoa cúc",
    "growthStages": [
      "Ra hoa",
      "Cơi đọt"
    ],
    "pestDiseases": [
      "Sâu",
      "Bệnh"
    ],
    "severityLevels": [
      "Nhẹ",
      "Trung bình",
      "Nặng",
      "Hết cứu",
      "Không có"
    ]
  },
  {
    "cropType": "Bầu bí dưa",
    "growthStages": [
      "Cây con",
      "Phá triển thân lá",
      "Ra hoa",
      "Cơi đọt",
      "Nuôi trái"
    ],
    "pestDiseases": [
      "Bệnh",
      "Sâu"
    ],
    "severityLevels": [
      "Không có",
      "Nhẹ",
      "Trung bình",
      "Nặng"
    ]
  },
  {
    "cropType": "Ớt",
    "growthStages": [
      "Cây con",
      "Nuôi trái",
      "Ra hoa"
    ],
    "pestDiseases": [
      "Bệnh",
      "Sâu"
    ],
    "severityLevels": [
      "Trung bình",
      "Nhẹ",
      "Nặng",
      "Không có"
    ]
  },
  {
    "cropType": "Cà chua",
    "growthStages": [
      "Cây con",
      "Nuôi trái",
      "Phát triển thân lá"
    ],
    "pestDiseases": [
      "Bệnh",
      "Sâu"
    ],
    "severityLevels": [
      "Không có",
      "Nhẹ",
      "Trung bình",
      "Nặng",
      "Hết cứu"
    ]
  },
  {
    "cropType": "Bắp cải",
    "growthStages": [
      "Phát triển thân lá"
    ],
    "pestDiseases": [
      "Sâu",
      "Bệnh"
    ],
    "severityLevels": [
      "Nhẹ",
      "Trung bình",
      "Nặng",
      "Không có"
    ]
  },
  {
    "cropType": "Cây hành",
    "growthStages": [
      "Cây con",
      "Phá triển thân lá"
    ],
    "pestDiseases": [
      "Bệnh",
      "Sâu"
    ],
    "severityLevels": [
      "Nhẹ",
      "Trung bình",
      "Nặng",
      "Hết cứu"
    ]
  },
  {
    "cropType": "Cây Xoài",
    "growthStages": [
      "Nuôi trái"
    ],
    "pestDiseases": [
      "Bệnh"
    ],
    "severityLevels": [
      "Không có",
      "Nhẹ",
      "Trung bình",
      "Nặng"
    ]
  },
  {
    "cropType": "Lúa",
    "growthStages": [
      "Xuống giống",
      "Sau thu hoạch",
      "Mạ",
      "Đẻ nhánh - làm đòng",
      "Đẻ nhánh",
      "Làm đòng - trổ",
      "Trổ - chín",
      "Trước & sau trổ"
    ],
    "pestDiseases": [
      "Cỏ",
      "Sâu",
      "Bệnh"
    ],
    "severityLevels": [
      "Nặng",
      "Nhẹ",
      "Trung bình"
    ]
  },
  {
    "cropType": "Cà phê",
    "growthStages": [
      "Sau thu hoạch",
      "Ra hoa",
      "Nuôi trái",
      "Cây con"
    ],
    "pestDiseases": [
      "Bệnh",
      "Sâu",
      "Cỏ"
    ],
    "severityLevels": [
      "Nhẹ",
      "Trung bình",
      "Nặng",
      "Không có"
    ]
  },
  {
    "cropType": "Bắp",
    "growthStages": [
      "Cây con"
    ],
    "pestDiseases": [
      "Cỏ"
    ],
    "severityLevels": [
      "Trung bình"
    ]
  },
  {
    "cropType": "Cây có múi",
    "growthStages": [
      "Nuôi trái"
    ],
    "pestDiseases": [
      "Bệnh"
    ],
    "severityLevels": [
      "Nặng",
      "Trung bình"
    ]
  }
];
