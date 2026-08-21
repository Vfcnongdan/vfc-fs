
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
    "cropType": "Hoa cúc/ly",
    "growthStages": [
      "Ra hoa",
      "Cơi đọt",
      "Phát triển thân lá"
    ],
    "pestDiseases": [
      "Sâu",
      "Không có",
      "Bệnh"
    ],
    "severityLevels": [
      "Nhẹ",
      "Trung bình",
      "Nặng",
      "Không có",
      "Hết cứu"
    ]
  },
  {
    "cropType": "Bầu bí dưa",
    "growthStages": [
      "Cây con",
      "Phát triển thân lá",
      "Ra hoa",
      "Cơi đọt",
      "Nuôi trái"
    ],
    "pestDiseases": [
      "Không có",
      "Bệnh",
      "Sâu"
    ],
    "severityLevels": [
      "Không có",
      "Trung bình",
      "Nặng",
      "Nhẹ"
    ]
  },
  {
    "cropType": "Cà phê",
    "growthStages": [
      "Nuôi trái",
      "Sau thu hoạch",
      "Ra hoa",
      "Cây con"
    ],
    "pestDiseases": [
      "Cỏ",
      "Bệnh",
      "Không có",
      "Sâu"
    ],
    "severityLevels": [
      "Nhẹ",
      "Trung bình",
      "Nặng",
      "Không có"
    ]
  },
  {
    "cropType": "Ớt",
    "growthStages": [
      "Cây con",
      "Nuôi trái",
      "Ra hoa",
      "Phát triển thân lá"
    ],
    "pestDiseases": [
      "Bệnh",
      "Không có",
      "Sâu"
    ],
    "severityLevels": [
      "Trung bình",
      "Nặng",
      "Nhẹ",
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
      "Không có",
      "Bệnh",
      "Sâu",
      "Cỏ"
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
    "cropType": "Lúa",
    "growthStages": [
      "Nuôi trái",
      "Sạ/ Xuống giống",
      "Mạ - Đẻ nhánh",
      "Đẻ nhánh - Đòng trổ",
      "Trổ/Chín"
    ],
    "pestDiseases": [
      "Cỏ",
      "Sâu",
      "Bệnh"
    ],
    "severityLevels": [
      "Trung bình",
      "Nặng",
      "Nhẹ"
    ]
  },
  {
    "cropType": "Bắp cải",
    "growthStages": [
      "Phát triển thân lá"
    ],
    "pestDiseases": [
      "Sâu",
      "Không có",
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
    "cropType": "Hành",
    "growthStages": [
      "Cây con",
      "Phát triển thân lá"
    ],
    "pestDiseases": [
      "Bệnh",
      "Sâu"
    ],
    "severityLevels": [
      "Trung bình",
      "Hết cứu",
      "Nhẹ",
      "Nặng"
    ]
  },
  {
    "cropType": "Xoài",
    "growthStages": [
      "Nuôi trái",
      "Sau thu hoạch",
      "Ra hoa",
      "Trái non",
      "Phát triển thân lá"
    ],
    "pestDiseases": [
      "Không có",
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
    "cropType": "Sầu riêng",
    "growthStages": [
      "Sau thu hoạch",
      "Cơi đọt",
      "Ra hoa",
      "Nuôi trái",
      "Phát triển thân lá",
      "Chạy trái"
    ],
    "pestDiseases": [
      "Bệnh",
      "Không có",
      "Sâu"
    ],
    "severityLevels": [
      "Nhẹ",
      "Trung bình",
      "Nặng",
      "Không có"
    ]
  },
  {
    "cropType": "Hồ tiêu",
    "growthStages": [
      "Nuôi trái",
      "Đẻ nhánh - Đòng trổ",
      "Ra hoa"
    ],
    "pestDiseases": [
      "Không có",
      "Sâu",
      "Bệnh"
    ],
    "severityLevels": [
      "Không có",
      "Trung bình",
      "Nặng"
    ]
  },
  {
    "cropType": "Đậu phộng",
    "growthStages": [
      "Sạ/ Xuống giống",
      "Phát triển thân lá"
    ],
    "pestDiseases": [
      "Sâu",
      "Bệnh"
    ],
    "severityLevels": [
      "Trung bình"
    ]
  },
  {
    "cropType": "Cây có múi (Cam, Quýt, Bưởi)",
    "growthStages": [
      "Phát triển thân lá",
      "Nuôi trái",
      "Sau thu hoạch",
      "Ra hoa"
    ],
    "pestDiseases": [
      "Bệnh",
      "Sâu",
      "Không có"
    ],
    "severityLevels": [
      "Nhẹ",
      "Trung bình",
      "Nặng",
      "Không có"
    ]
  },
  {
    "cropType": "Nhãn",
    "growthStages": [
      "Sau thu hoạch",
      "Nuôi trái",
      "Phát triển thân lá"
    ],
    "pestDiseases": [
      "Bệnh",
      "Sâu"
    ],
    "severityLevels": [
      "Trung bình"
    ]
  },
  {
    "cropType": "Rau - Hoa",
    "growthStages": [
      "Nuôi trái",
      "Phát triển thân lá"
    ],
    "pestDiseases": [
      "Bệnh"
    ],
    "severityLevels": [
      "Trung bình"
    ]
  }
];

