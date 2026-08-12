/**
 * Script to insert product details from CSV into the database.
 * Maps CSV product names to existing DB products (corrected names).
 * Delfan Plus variants ("Nuôi hoa", "Bung đọt") are not in the DB, so skipped.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Product details data extracted from the CSV, mapped to DB product names
// The "name" field uses the DB product name (corrected spelling).
const productDetailsData = [
  {
    dbProductName: 'Michelle 62EC',
    name: 'Michelle 62EC',
    plantCrops: 'Lúa (gieo sạ)',
    type: 'Thuốc trừ cỏ tiền nảy mầm',
    ingredients: 'Butachlor 620g/lít',
    targetDiseases: 'Cỏ lồng vực, cỏ đuôi phụng, cỏ lá rộng, cỏ cháo, cỏ chác',
    usageInstruction: `Liều dùng 0.8 - 1.2L/ ha (thường 1.2L/ha)
Lượng nước phun 300 - 400L/ha. Phun thuốc khi nền đất đủ ẩm
Phun 1–4 ngày sau sạ khi nền đất đủ ẩm; giữ nước 5–7 ngày sau sạ và tiếp tục giữ nước, tránh để ruộng khô nứt nẻ.`,
    description: `Michelle 62EC là thuốc trừ cỏ tiền nảy mầm cho lúa, Diệt tất cả các loại cỏ và lúa cơi trên ruộng lúa. Thuốc được hấp thu dễ dàng qua tất cả các bộ phận của cây cỏ như rễ cỏ và mầm cỏ
Quy cách đóng gói: 1.2 Lít, 1 Lít, 500ml, 100ml
Phù hợp cho phun máy bay không người lái (drone)`,
  },
  {
    dbProductName: 'Atas 500EC',
    name: 'Atas 500EC',
    plantCrops: 'Bắp, mía, đậu phộng, khoai mì (sắn)',
    type: 'Thuốc trừ cỏ',
    ingredients: 'Acetochlor 500g/l',
    targetDiseases: 'Cỏ lá rộng và cỏ lá hẹp.',
    usageInstruction: `Liều lượng: 0.8 – 1.0 lít/ha.
Cách dùng: Pha 50ml thuốc cho bình 16 – 20 lít.
Thời điểm phun: phun thuốc từ 0 - 3 ngày sau khi gieo hạt và phun trong điều kiện đất ẩm. Lượng nước phun 400 lít/ha`,
    description: `Atas 500EC là thuốc trừ cỏ diệt mầm có tác dụng đặc trị các loại cỏ lá rộng và lá hẹp trên nhiều loại cây trồng như bắp, mía, đậu phộng, khoai mì (sắn) giúp kiểm soát cỏ dại hiệu quả ngay từ đầu vụ, an toàn cho cây trồng và tiết kiệm công lao động
Quy cách đóng gói: 500ml, 450ml, 100ml, 50ml
Phù hợp cho phun máy bay không người lái (drone)`,
  },
  {
    dbProductName: 'Nominee 10SC',
    name: 'Nominee 10SC',
    plantCrops: 'Lúa',
    type: 'Thuốc trừ cỏ hậu nảy mầm',
    ingredients: 'Bispyribac sodium 100g/l',
    targetDiseases: 'Cỏ hậu nảy mầm trên ruộng lúa, diệt các loại cỏ hòa bản, cỏ lác, cỏ lá rộng phổ biến như cỏ đuôi phụng, lồng vực, cháo, chác, u du, rau mác, rau bợ',
    usageInstruction: `Liều dùng: 0.2 - 0.3 lít/ha
Pha 10 - 15ml cho bình 16 lít. Phun 2 bình 16 lít cho một công (1000m2).
Phun 10ml Nominee và 10ml chất phụ trợ trong bình phun 16 lít. Phun trong điều kiện đất ẩm, cỏ không bị ngập nước và phun trải đều để thuốc tiếp xúc tốt với lá cỏ.
Phun sau sạ 7 - 20 ngày ( 2- 5 lá cỏ).
Cho nước vào ruộng từ 1 - 2 ngày sau phun và giữ nước trong vòng 5 - 7 ngày.`,
    description: `Nominee 10SC chủ yếu dùng để trừ cỏ hậu nảy mầm trên ruộng lúa, diệt các loại cỏ hòa bản, cỏ lác, cỏ lá rộng phổ biến như cỏ đuôi phụng, lồng vực, cháo, chác, u du, rau mác, rau bợ
Quy cách đóng gói: 100ml, 50ml, 20ml, 10ml`,
  },
  {
    dbProductName: 'Nominee 10OF',
    name: 'Nominee 10OF',
    plantCrops: 'Lúa',
    type: 'Thuốc trừ cỏ hậu nảy mầm',
    ingredients: 'Bispyribac sodium 100g/l',
    targetDiseases: 'Cỏ hòa bản, cỏ lác và cỏ lá rộng',
    usageInstruction: `Liều dùng: 0.2 - 0.3 lít/ha
Pha 10 - 15ml cho bình 16 lít. Phun 2 bình 16 lít cho một công (1000m2).
Phun trong điều kiện đất ẩm, cỏ không bị ngập nước và phun trải đều để thuốc tiếp xúc tốt với lá cỏ. Cho nước vào ruộng từ 1 - 2 ngày sau phun và giữ nước trong vòng 5 - 7 ngày.
Phun sau sạ 7 - 20 ngày ( 2- 5 lá cỏ).`,
    description: `Nominee 10OF có tác dụng hậu nảy mầm, diệt trừ các loại cỏ hòa bản, cỏ lác và cỏ lá rộng.
Quy cách đóng gói: 100ml`,
  },
  {
    dbProductName: 'MAZDA 200SL',
    name: 'MAZDA 200SL',
    plantCrops: 'Cà phê',
    type: 'Thuốc trừ cỏ',
    ingredients: 'Glufosinate ammonium 200g/l',
    targetDiseases: 'Cỏ dại, cỏ không chọn lọc, cỏ dại khó trị như cỏ chỉ, cỏ mần trầu, cỏ tranh, cỏ ống, cỏ cú, cỏ lá rộng và cỏ lá hẹp',
    usageInstruction: `Liều lượng: 2.5 kg/ha
Cách dùng: Pha 400 - 450ml/ 100 lít nước hoặc 120 - 125ml/ 25 lít nước, phun 500- 600 lít nước/ha.
Thời điểm phun: Phun thuốc khi cỏ đang xanh tốt, không phun thuốc lên phần xanh của cây trồng như lá, mô non. Không phun lên cỏ sinh trưởng kém, trong điều kiện khô hạn hay ngập úng.`,
    description: `Sản phẩm MAZDA 200SL là thuốc diệt cỏ không chọn lọc, thế hệ mới, có công dụng diệt trừ hiệu quả các loại cỏ dại khó trị như cỏ chỉ, cỏ mần trầu, cỏ tranh, cỏ ống, cỏ cú, cỏ lá rộng và cỏ lá hẹp, giúp tăng năng suất cây trồng thông qua việc kiểm soát cỏ dại một cách nhanh chóng và an toàn cho môi trường nhờ hoạt chất Glufosinate-ammonium có khả năng phân hủy trong đất
Quy cách đóng gói: 4 lít, 900ml, 450ml, 90ml`,
  },
  {
    dbProductName: 'Opal 50WG',
    name: 'Opal 50WG',
    plantCrops: 'Bắp (ngô)',
    type: 'Thuốc trừ sâu',
    ingredients: 'Pymetrozine 40% + Dinotefuran 10%',
    targetDiseases: 'Rệp muội',
    usageInstruction: `Liều lượng: 0.30 kg/ha (20–25 g/bình 25 L)
Cách dùng: Pha 10-15g thuốc cho bình 16 lít, phun 500-600 lít nước/ha
Thời điểm phun: Tùy theo thời gian sinh trưởng cây ngô (bắp). Phun lặp lại lần hai nếu áp lực rệp muội cao. Ngưng phun thuốc trước khi thu hoạch 10 ngày`,
    description: `Opal 50WG là sự cộng hưởng hữu hiệu của hai hoạt chất, có tác dụng tiếp xúc, vị độc và lưu dẫn mạnh nên đặc trị rệp muội hại ngô (bắp).
Quy cách đóng gói: 100g, 25g, 15g`,
  },
  {
    dbProductName: 'Solo 350SC',
    name: 'Solo 350SC',
    plantCrops: 'Lúa, Lạc, Đậu xanh',
    type: 'Thuốc trừ sâu',
    ingredients: 'Chlorfenapyr 350g/l',
    targetDiseases: `Lúa: Sâu cuốn lá
Lạc: Sâu xanh da láng
Đậu xanh: Sâu xanh da láng`,
    usageInstruction: `Lúa: 0.25 - 0.3 lít/ha.
Lạc: 0.3 lít/ha.
Đậu xanh: 0.3 lít/ha.
Cách dùng: Pha 20ml thuốc cho bình 25 lít, phun 400 lít nước/ha.
Thời điểm phun: Phun khi bướm ra rộ hoặc sâu tuổi 1 - 2. Trong trường hợp mật số sâu cao hoặc gối lửa cần phải phun lặp lại 5 - 7 ngày sau. Ngưng phun thuốc trước khi thu hoạch 14 ngày.`,
    description: `Solo 350SC là thuốc trừ sâu chứa hoạt chất Chlorfenapyr có chất lượng cao chuyên được sử dụng để quản lý sâu cuốn lá, sâu xanh da láng,… diệt sâu tận ổ.
Quy cách đóng gói: 100ml, 30ml, 20ml, 15ml, 10ml`,
  },
  {
    dbProductName: 'Xantocin 40WP',
    name: 'Xantocin 40WP',
    plantCrops: 'Lúa, Hồ tiêu',
    type: 'Thuốc trừ bệnh',
    ingredients: 'Bronopol 400g/kg',
    targetDiseases: `Lúa: Cháy bìa lá (bạc hà), thối gốc do vi khuẩn.
Hồ tiêu: Bệnh chết chậm`,
    usageInstruction: `Lúa: Liều lượng: 0.2 - 0.25 kg/ha. Cách dùng: Pha 18 - 20g thuốc cho bình 25 lít, phun 300- 400 lít nước/ha. Thời điểm phun: Phun phòng ngừa hoặc khi bệnh chớm xuất hiện.
Hồ tiêu: Liều lượng: 0.05% kg/ha. Cách dùng: Pha 50g/100 lít nước cho bình 25 lít, phun 300 - 400 lít nước/ha. Thời điểm phun: Tưới đều quanh gốc khi bệnh chớm xuất hiện 4 - 5 lít/gốc.
Khi áp lực bệnh cao nên phun lần 2 cách nhau 5 - 7 ngày. Ngưng phun thuốc trước khi thu hoạch 1 ngày.`,
    description: `Xantocin 40WP là thuốc thế hệ mới hấp thu nhanh qua lá và rễ. Tác động vừa diệt vi khuẩn vừa kích hoạt tinh đề kháng cho cây trồng. Đặc trị bệnh cháy bìa lá (bạc lá), thối gốc lúa do vi khuẩn và bệnh chết chậm hồ tiêu.
Quy cách đóng gói: 100g, 18g, 10g`,
  },
  {
    dbProductName: 'Combo 600WG',
    name: 'Combo 600WG',
    plantCrops: 'Ớt',
    type: 'Thuốc trừ bệnh',
    ingredients: 'Pyraclostrobin 5% + Metiram 55%',
    targetDiseases: 'Thán thư',
    usageInstruction: `Liều lượng: 1.5 kg/ha
Cách dùng: Pha 60 - 75g thuốc cho bình 25 lít, phun 500- 600 lít nước/ha
Thời điểm phun: Phun phòng ngừa hoặc khi bệnh chớm xuất hiện hoặc tỉ lệ bệnh 5%. Phun ước đều tán cây trồng, nếu áp lực bệnh cao nên phun lần 2 cách nhau 5 - 7 ngày.
Combo 600WG có thể phối hợp phun với thuốc trừ sâu, trừ bệnh khác ngoại trừ thuốc tính kiềm
Ngưng phun thuốc trước khi thu hoạch 7 ngày.`,
    description: `Combo 600WG là thuốc trừ bệnh thế hệ mới, hiệu lực cao, chặn đứng nhanh bệnh thán thư hại ớt và kéo dài hiệu lực phòng ngừa. Cây trồng phục hồi và sinh trưởng khỏe.
Quy cách đóng gói: 500g, 100g`,
  },
  {
    // CSV: "Champion 57.6 DP" -> DB: "Champion 57.6DP" (no space before DP)
    dbProductName: 'Champion 57.6DP',
    name: 'Champion 57.6DP',
    plantCrops: 'Cà chua, Nho, Cà phê, Cây có múi, Xoài, Cao su, Bắp cải, Lúa',
    type: 'Thuốc trừ bệnh',
    ingredients: 'Copper hydroxide 57.6 %',
    targetDiseases: `Rụng quả, bệnh gốc đồng.
Các loại nấm và vi khuẩn gây hại:
cà chua (mốc sương), nho (phấn trắng), cây có múi (sẹo, chảy mủ), xoài (thán thư, chảy mủ), cà phê (tảo đỏ, nấm hồng), cao su (nấm hồng), bắp cải (thối nhũn) và lúa (cháy bìa lá)`,
    usageInstruction: `Liều lượng: 0.15% kg/ha
Cách dùng: Pha 150 g cho 100 lít nước, phun 600- 1000 lít nước/ha.
Thời điểm phun: Phun ướt đều cây trồng khi tỷ lệ bệnh khoảng 3 - 7%. Nếu áp lực bệnh cao nên phun 2 lần cách nhau 5 - 7 ngày.
Ngưng phun thuốc trước khi thu hoạch 7 ngày.`,
    description: `Sản phẩm Champion 57.6DP là thuốc trừ bệnh gốc đồng, công dụng chính là phòng ngừa và đặc trị các loại nấm và vi khuẩn gây hại trên nhiều loại cây trồng như cà chua (mốc sương), nho (phấn trắng), cây có múi (sẹo, chảy mủ), xoài (thán thư, chảy mủ), cà phê (tảo đỏ, nấm hồng), cao su (nấm hồng), bắp cải (thối nhũn) và lúa (cháy bìa lá).
Quy cách đóng gói: 300g, 60g`,
  },
  {
    dbProductName: 'Amifol K',
    name: 'Amifol K',
    plantCrops: 'Rau màu',
    type: 'Phân bón lá - Kali',
    ingredients: 'Kali hữu hiệu (K2Ohh): 31% + Axit amin: 5%l pHH2O: 12; Tỷ trọng: 1,4',
    targetDiseases: 'Giúp cây hấp thụ nhanh, chuyển hóa mạnh, cho năng suất vượt trội',
    usageInstruction: `Pha 50 - 60ml cho bình 16 lít hoặc pha 75 - 90ml cho bình 25 lít.
Phun định kỳ vào các giai đoạn 7, 14 và 21 ngày
Phun 360 lít/ha
Phương thức sử dụng: bón lá.
Amifol K có thể hỗn hợp với thuốc trừ sâu, trừ bệnh và phân bón lá khác.`,
    description: `Amifol K là nguồn dinh dưỡng vô cùng cần thiết cho năng suất và chất lượng nông sản, chứa hỗn hợp hoạt chất tiên tiến chứ L - Amino acids tự do và Kali chất lượng cao, giúp cây hấp thụ nhanh, chuyển hóa mạnh, cho năng suất vượt trội.
Quy cách đóng gói: 200ml`,
  },
  {
    dbProductName: 'Delfan Plus',
    name: 'Delfan Plus',
    plantCrops: 'Cà phê, Tiêu, Cây ăn quả, Lúa, Hoa, Rau màu',
    type: 'Phân bón',
    ingredients: 'Amino Acid 24,3%; Hữu cơ 37%; Đạm hữu hiệu 9%',
    targetDiseases: 'Phục hồi cây sau thu hoạch, chống chịu tốt. Kích thích sinh trưởng bật chồi, ra đọt non, xanh lá và giúp lá đòng to khỏe (đối với cây lúa). Nuôi hoa và trái, kích thích mầm hoa, tăng tỷ lệ đậu trái, chống rụng hoa/trái non; giúp trái lớn nhanh, hạt to chắc',
    usageInstruction: `Cà phê, tiêu, Cây ăn quả: Liều dùng: 250ml cho bình 200 lít. Phun 500 - 1000 lít/ha, nên phun ướt đều tán cây. Phun vào giai đoạn sau khi thu hoạch, cắt cành tạo tán. Trước khi ra hoa, đậu trái và nuôi trái.
Lúa: Liều dùng: 20 - 25ml cho bình 25 lít. Phun 400 - 600 lít/ha, nên phun ướt đều tán cây. Phun vào giai đoạn lúa từ đẻ nhánh đến làm đồng, 7 - 10 ngày trước và sau khi trổ đều.
Hoa, rau màu: Liều dùng: 20 - 25ml cho bình 25 lít. Phun 400 - 600 lít/ha, nên phun ướt đều tán cây. Phun định kỳ cách nhau 7 - 10 ngày/lần.`,
    description: `Delfan Plus là sản phẩm phân bón lá dạng nước đậm đặc, hấp thụ nhanh qua lá và rễ.
Quy cách đóng gói: 500ml, 250ml, 100ml`,
  },
  // Delfan Plus - Nuôi hoa and Delfan Plus - Bung đọt are NOT in the DB products table.
  // They are skipped.
  {
    dbProductName: 'Tora 1.1SL',
    name: 'Tora 1.1SL',
    plantCrops: 'Lúa',
    type: 'Thuốc kích thích sinh trưởng cây trồng',
    ingredients: '1-Triacontanol 1.1 g/l',
    targetDiseases: `Thúc đẩy cây đẻ nhánh sớm, ra rễ mạnh, kích thích lúa trổ bông, trổ thoát đồng loạt. Giúp quá trình vô gạo diễn ra siêu tốc, hạt lúa chắc tới cậy, vàng sáng và nặng ký.
Tăng sức chống sốc: tăng khả năng chống chịu thời tiết khắc nghiệt như sương muối, rét lạnh, nắng hạn hoặc ngập mặn`,
    usageInstruction: `Liều dùng: 0.25 lít/ha
Pha 1 gói cho bình 25 lít.
Cách dùng:
- Lần 1: 20 - 25 ngày sau sạ
- Lần 2: Trước khi trổ (lẹt xẹt)
- Lần 3: Khi trổ đều`,
    description: `Tora 1.1SL "Tối Đa Năng Suất" có nguồn gốc từ thiên nhiên, an toàn cho môi trường và sức khỏe nông dân, chứa hoạt tính kích thích sinh trưởng cực mạnh, giúp lúa trổ cực nhanh, vào gạo cực mạnh.
Quy cách đóng gói: 100ml, 25ml, 15ml`,
  },
  {
    // CSV: "Amistar Top® 325SC" -> DB: "Amistar Top 325SC"
    dbProductName: 'Amistar Top 325SC',
    name: 'Amistar Top 325SC',
    plantCrops: 'Lúa, Cà phê, Cao su, Hồ tiêu, Hoa hồng, Lạc, Ngô',
    type: 'Thuốc trừ bệnh',
    ingredients: '200g/L Azoxystrobin + 125g/L Difenoconazole',
    targetDiseases: `Lúa: Khô vằn.
Cà phê: Rỉ sắt, Thán thư.
Cao su: Khô nứt vỏ. Phấn trắng. Vàng lá
Hồ tiêu: Thán thư
Hoa hồng: Phấn trắng
Lạc: Chết cây con
Ngô: Đốm lá lớn. Rỉ sắt.`,
    usageInstruction: `Lúa: Khô vằn: 0.25 - 0.3L/ha. Phun thuốc vào thời điểm lúa làm đòng. Cách ly 10 ngày. Lem lép hạt: 0.35L/ha. Phun thuốc vào lúc trước và sau khi lúa trổ. Cách ly 10 ngày.
Cà phê: Rỉ sắt: 0.20%. Phun ướt đều cây khi bệnh chớm xuất hiện. Cách ly 10 ngày. Thán thư: 0.1 - 0.2%. Phun ướt đều cây khi bệnh chớm xuất hiện. Cách ly 10 ngày.
Cao su: Khô nứt vỏ: 1.5 - 3.0%. Phun ướt đều cây trồng khi tỷ lệ bệnh khoảng 4 - 6%. Cách ly 10 ngày. Phấn trắng: 0.05 - 0.1 %. Phun ướt đều cây trồng khi tỷ lệ bệnh khoảng 5 - 10%. Cách ly 10 ngày. Vàng lá: 0.1 - 0.2%. Phun ướt đều cây trồng khi tỷ lệ bệnh khoảng 5 - 10%. Cách ly 10 ngày.
Hồ tiêu: Thán thư: 0.1%. Lượng nước 600 - 800L/ha. Phun thuốc khi tỷ lệ bệnh khoảng 5 - 10%. Cách ly 10 ngày.
Hoa hồng: Phấn trắng: 0.35L/ha. Phun thuốc 2 lần. Lần 1 khi tỉ lệ bệnh 5%. Lần 2 sau lần 1 khoảng 5 - 7 ngày. Cách ly 10 ngày.
Lạc: Chết cây con: 0.3L/ha. Phun thuốc 2 lần. Lần 1 khi tỉ lệ bệnh 5%. Lần 2 sau lần 1 khoảng 5 - 7 ngày. Cách ly 10 ngày.
Ngô: Đốm lá lớn: 0.25 - 0.5L/ha. Phun thuốc khi bệnh xuất hiện, tỷ lệ bệnh khoảng 5%. Cách ly 10 ngày. Khô vằn: 0.5L/ha. Phun thuốc khi bệnh xuất hiện, tỷ lệ bệnh khoảng 5%. Cách ly 10 ngày. Rỉ sắt: 0.4 - 0.5L/ha. Phun thuốc khi bệnh xuất hiện, tỷ lệ bệnh khoảng 5%. Cách ly 10 ngày.`,
    description: `Amistar Top 325SC là thuốc trừ bệnh nội hấp và lưu dẫn mạnh, được trang bị công nghệ Amistar đã được chứng minh, có khả năng kiểm soát phổ rộng hiệu quả.
Dạng thuốc: SC (Huyền Phù Đậm Đặc)
Quy cách đóng gói: 250ml, 100ml, 10ml
Phù hợp cho phun máy bay không người lái (drone)
Công Nghệ:
- Sản phẩm thuốc trừ nấm bệnh tuyệt vời nhờ Công nghệ Amistar đã được chứng minh.
- Amistar Top 325SC nổi bật với cơ chế tác động kép, có khả năng thấm sâu, chuyển vị và lưu dẫn mạnh. Cho hiệu lực kéo dài, hạn chế mưa rửa trôi và có thể hoạt động tốt trong các nhiều điều kiện thời tiết.
- Amistar Top 325SC là loại thuốc trừ nấm phổ rộng, có thể vừa phòng vừa trị nhiều loại bệnh khác nhau như rỉ sắt, thán thư,... trên các loại cây trồng như cà phê, cao su, hồ tiêu, hoa hồng, ...`,
  },
  {
    // CSV: "Anvil® 5SC" -> DB: "Anvil 5SC"
    dbProductName: 'Anvil 5SC',
    name: 'Anvil 5SC',
    plantCrops: 'Cà phê, Cam, Cao su, Hoa hồng, Lạc, Lúa, Ngô, Thuốc lá, Thanh long',
    type: 'Thuốc trừ bệnh',
    ingredients: '50g/L Hexaconazole',
    targetDiseases: `Cà phê: Đốm vòng, Rỉ sắt, nấm hồng
Cam: Ghẻ sẹo
Cao su: Nấm hồng, Phấn trắng, Vàng lá
Hoa hồng: Phấn trắng, rỉ sắt, đốm đen
Lạc: Đốm lá
Lúa: Lem lép hạt, khô vằn
Ngô: Khô vằn
Thuốc lá: Lở cổ rễ
Thanh long: Đốm nâu`,
    usageInstruction: `Cà phê: Đốm vòng: 0.25%. Lượng nước phun 600 - 800L/ha. Phun khi thấy 15% lá bị hại. Cách ly 14 ngày. Rỉ sắt, nấm hồng: 1.0 - 2.0L/ha. Lượng nước phun 600 - 800L/ha. Phun khi thấy 15% lá bị hại. Cách ly 14 ngày.
Cam: Ghẻ sẹo: 0.30%. Lượng nước phun 600 - 800L/ha. Phun thuốc khi tỷ lệ bệnh khoảng 5%. Cách ly 7 ngày.
Cao su: Nấm hồng: 0.50%. Phun ướt đều cây trồng khi tỷ lệ bệnh hại khoảng 5 - 10%. Cách ly 14 ngày. Phấn trắng: 0.08% - 0.16%. Phun ướt đều cây trồng khi tỷ lệ bệnh hại khoảng 5 - 10%. Cách ly 14 ngày. Vàng lá: 0.2 - 0.6%. Phun ướt đều cây trồng khi tỷ lệ bệnh hại khoảng 5 - 10%. Cách ly 14 ngày.
Hoa hồng: Phấn trắng, rỉ sắt, đốm đen: 0.3 - 0.5L/ha. Lượng nước phun 320 - 600L/ha. Phun khi thấy bệnh xuất hiện. Cách ly 14 ngày.
Lạc: Đốm lá: 1.0L/ha. Lượng nước 320 - 600L/ha. Phun khi thấy bệnh xuất hiện. Cách ly 14 ngày.
Lúa: Lem lép hạt, khô vằn: 1.0L/ha. Lượng nước 320 - 600L/ha. Phun khi thấy bệnh xuất hiện. Cách ly 14 ngày.
Ngô: Khô vằn: 1.0 - 1.5L/ha. Lượng nước 320 - 600L/ha. Phun khi thấy bệnh xuất hiện. Cách ly 14 ngày.
Thuốc lá: Lở cổ rễ: 0.5 - 1.0L/ha. Lượng nước 320 - 600L/ha. Phun khi thấy bệnh xuất hiện. Cách ly 14 ngày.
Thanh long: Đốm nâu: 0.30%. Lượng nước 600 - 800L/ha. Phun thuốc khi tỷ lệ bệnh khoảng 5%. Cách ly 7 ngày.`,
    description: `Anvil 5SC là thuốc trừ bệnh phổ rộng, giải pháp số 01 giúp cây trồng xanh khỏe và sạch bệnh
Dạng thuốc: SC (Huyền Phù Đậm Đặc)
Quy cách đóng gói: 1L, 250ml, 100ml, 20ml
Phù hợp cho phun máy bay không người lái (drone)
Công Nghệ
- Anvil 5SC là sản phẩm danh tiếng của Syngenta được hàng triệu nông dân Việt Nam tin dùng.
- Anvil 5SC có phổ phòng trừ nấm bệnh rất rộng. Bên cạnh việc kiểm soát tốt bệnh lem lép hạt và đốm vằn trên lúa, sản phẩm còn kiểm soát tốt nhiều loại bệnh trên các loại cây trồng khác như gỉ sắt, nấm hồng, ... trên cà phê, thuốc lá, đậu phộng, ...
- Anvil 5SC với dạng thành phẩm huyền phù đậm đặc SC giúp các hoạt chất thuốc hòa tan nhanh và phân bố đồng đều khi pha trong nước, mang lại nhiều ưu điểm nổi trội trong việc bao phủ trên bề mặt cây trồng và phát huy hiệu quả phòng trừ bệnh hại.`,
  },
  {
    // CSV: "Nevo® 330EC" -> DB: "Nevo 330EC"
    dbProductName: 'Nevo 330EC',
    name: 'Nevo 330EC',
    plantCrops: 'Lúa',
    type: 'Thuốc trừ bệnh',
    ingredients: '80g/L Cyproconazole + 250g/L Propiconazole',
    targetDiseases: `Khô vằn
Lem lép hạt
Thối thân`,
    usageInstruction: `Khô vằn: 0.3 - 0.5L/ha. Lượng nước 400 - 500L/ha. Phun thuốc khi thấy bệnh xuất hiện. Cách ly 15 ngày.
Lem lép hạt: 0.25L/ha. Lượng nước 400 - 500L/ha. Phun thuốc khi thời tiết thuận lợi cho bệnh phát triển. Cách ly 15 ngày.
Thối thân: 0.2 - 0.5L/ha. Lượng nước 400 - 500L/ha. Phun thuốc khi bệnh xuất hiện. Cách ly 15 ngày.`,
    description: `Nevo 330EC là thuốc trừ bệnh lưu dẫn và nội hấp, tác động tiêu diệt nấm bệnh thông qua cơ chế ngăn cản sinh tổng hợp Ergosterol (chất cấu tạo nên màng tế bào nấm bệnh).
Dạng thuốc: EC (Dạng nhũ tương đậm đặc)
Dung tích: 250ml, 100ml, 10ml`,
  },
  {
    // CSV: "Revus Opti® 440SC" -> DB: "Revus Opti 440SC"
    dbProductName: 'Revus Opti 440SC',
    name: 'Revus Opti 440SC',
    plantCrops: 'Cà chua, Dưa chuột, Dưa hấu, Hồ tiêu, Khoai tây, Xoài',
    type: 'Thuốc trừ bệnh',
    ingredients: '40g/L Mandipropamid + 400g/L Chlorothalonil',
    targetDiseases: `Cà chua: Sương mai
Dưa chuột: Mốc sương
Dưa hấu: Nứt dây
Hồ tiêu: Thán thư. Thối rễ
Khoai tây: Mốc sương, đốm vòng.
Xoài: Thán thư`,
    usageInstruction: `Cà chua: Sương mai: 2.0 - 2.5L/ha. Lượng nước 600 - 1000L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 5 ngày.
Dưa chuột: Mốc sương: 1.5 - 2.0L/ha. Lượng nước 600 - 1000L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 1 ngày.
Dưa hấu: Nứt dây: 2.0L/ha. Lượng nước 600 - 1000L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 1 ngày.
Hồ tiêu: Thán thư: 0.2 - 0.4%. Phun ướt đều cây khi tỷ lệ bệnh khoảng 5 - 10%. Cách ly 5 ngày. Thối rễ: 0.2 - 0.4%. Thuốc được tưới trực tiếp vào gốc 2 lần cách nhau 21 ngày, lần đầu khi bệnh xuất hiện. Cách ly 5 ngày.
Khoai tây: Mốc sương, đốm vòng: 2.0 - 2.5L/ha. Lượng nước 400 - 500L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 5 ngày.
Xoài: Thán thư: 0.2 - 0.4%. Lượng nước 600 - 1000L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 5 ngày.`,
    description: `Revus Opti 440SC là thuốc trừ bệnh phổ rộng, tác động trừ nấm bệnh thông qua 2 cơ chế độc đáo, giúp thuốc chống khả năng rửa trôi và kiểm soát nấm bệnh với hiệu lực kéo dài.
Dạng thuốc: SC (Huyền Phù Đậm Đặc)
Quy cách đóng gói: 500ml, 100ml
Công Nghệ
Revus Opti 440SC là thuốc trừ bệnh phổ rộng, tác động trừ nấm bệnh thông qua 2 cơ chế độc đáo:
Ngăn cản quá trình sinh tổng hợp PHOSPHOLIPID là chất cần thiết cho quá trình hình thành ống mầm và phát triển hệ sợi nấm.
Tác động lên hệ men tham gia tiến trình trao đổi chất ở nấm nhằm ngăn cản sự nảy mầm của bào tử và gây hại cho màng tế bào nấm bệnh.
Bào tử nhiễm thuốc không nảy mầm, mọc khuẩn ty và bị khô chết trên bề mặt lá.
Lok & Flo
Cơ chế Lok & Flo giúp thuốc bám chặt và thấm sâu tránh bị nước mưa rửa trôi.
Đặc trị nấm bệnh trên nhiều loại cây trồng, đặc biệt là bệnh Phytophthora và các bệnh gây ra bởi nhóm Oomycetes
Bảo vệ cây sạch bệnh giúp cây xanh mướt quang hợp mạnh năng suất cao.`,
  },
  {
    // CSV: "Ridomil Gold® 68WG" -> DB: "Ridomil Gold 68WG"
    dbProductName: 'Ridomil Gold 68WG',
    name: 'Ridomil Gold 68WG',
    plantCrops: 'Cao su, Điều, Hồ tiêu, Ca cao, Lạc, Ngô, Thuốc lá',
    type: 'Thuốc trừ bệnh',
    ingredients: '40g/L Metalaxyl-M (Mefenoxam) + 640g/L Mancozeb',
    targetDiseases: `Cao su: Loét sọc mặt cạo
Điều: Thán thư
Hồ tiêu: Chết nhanh
Ca cao: Sương mai
Lạc: Chết cây con
Ngô: Đốm lá
Thuốc lá: Chết cây con`,
    usageInstruction: `Cao su: Loét sọc mặt cạo: 0.30%. Cạo sọc vết cắt, quét dung dịch lên mặt cạo. Cách ly 14 ngày.
Điều: Thán thư: 0.5 - 0.6%. Lượng nước 600 - 1000L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 14 ngày.
Hồ tiêu: Chết nhanh: 0.30%. Lượng nước 600 - 1000L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 14 ngày.
Ca cao: Sương mai: 0.4 - 0.75%. Lượng nước 600 - 1000L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 14 ngày.
Lạc: Chết cây con: 3kg/ha. Lượng nước 400 - 500L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 14 ngày.
Ngô: Đốm lá: 2.0 - 3.0kg/ha. Lượng nước 400 - 500L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 14 ngày.
Thuốc lá: Chết cây con: 1.25 - 2.25kg/ha. Lượng nước 400 - 500L/ha. Phun thuốc khi tỷ lệ bệnh xuất hiện. Cách ly 14 ngày.`,
    description: `Ridomil Gold 68WG là thuốc trừ bệnh phổ rộng, đặc trị nhiều nấm bệnh khó trị trên đa dạng cây trồng.
Dạng thuốc: WG (Dạng cốm)
Dung tích: 1kg, 100g
Công Nghệ
Ridomil Gold 68WG là sản phẩm thuốc trừ bệnh giúp bảo vệ cây trồng một cách linh hoạt, toàn diện bằng hai cơ chế tác động độc đáo.
Ức chế hoạt động Enzyme xúc tác tạo ra năng lượng ATP của tế bào nấm bệnh
Ngăn cản sự tổng hợp RNA trong tế bào nấm bệnh
Thuốc tiếp xúc và thấm sâu nhanh, lưu dẫn mạnh, mang lại hiệu quả phòng trừ cao giúp bảo vệ cây trồng một cách toàn diện.
Sử dụng linh hoạt bằng nhiều biện pháp xử lý như phun, tưới gốc, quét trực tiếp lên vết bệnh, …`,
  },
  {
    // CSV: "BLASTOGAN® 75WP" -> DB: "Blastogan 75WP" (caps + ® )
    dbProductName: 'Blastogan 75WP',
    name: 'Blastogan 75WP',
    plantCrops: 'Lúa',
    type: 'Thuốc trừ bệnh',
    ingredients: '750g/kg Tricyclazole',
    targetDiseases: 'Đặc trị và kiểm soát hiệu quả bệnh đạo ôn lá (cháy lá) và đạo ôn cổ bông trên cây lúa.',
    usageInstruction: `Đạo ôn lá (Cháy lá): Liều lượng khuyến cáo 250 – 400 g/ha (Hoặc khoảng 25 g/công 1000 m²); Phun khi vết bệnh chớm xuất hiện, tỷ lệ bệnh khoảng 5-10%.
Đạo ôn cổ bông: Liều lượng khuyến cáo 300 – 400 g/ha (Hoặc khoảng 30 – 40 g/công 1000 m²); Phun lần 1 vào cuối giai đoạn làm đòng (trước khi lúa trổ). Nếu áp lực bệnh cao, phun thêm lần 2 sau khi lúa trổ để đạt hiệu quả tối đa.`,
    description: `Blastogan 75WP - Đặc trị và kiểm soát hiệu quả bệnh đạo ôn lá (cháy lá) và đạo ôn cổ bông trên cây lúa.
Dạng thuốc: WP (dạng bột mịn)
Quy cách đóng gói: 75g
Hiệu quả vượt trội trong phòng trừ đạo ôn:
Hiệu quả cao, làm khô nhanh vết bệnh.
Giúp xanh lá và xanh gié.
An toàn cho lúa.
Bảo vệ năng suất tối ưu.`,
  },
  {
    // CSV: "Incipio® 100DC" -> DB: "Incipio 100DC"
    dbProductName: 'Incipio 100DC',
    name: 'Incipio 100DC',
    plantCrops: 'Bắp cải',
    type: 'Thuốc trừ sâu',
    ingredients: 'Isocycloseram 100g/L',
    targetDiseases: 'Sâu tơ',
    usageInstruction: 'Sâu tơ: 20ml/bình 20L. Phun khi sâu mới xuất hiện tuổi 1-2, Mật độ khoảng 3-4 con/cây',
    description: `Incipio 100DC được chế tạo từ công nghệ PLINAZOLIN® – công nghệ hoạt chất tiên tiến nhất hiện nay. Incipio 100DC là sản phẩm đầu tiên của Syngenta sở hữu dạng thành phẩm DC, có khả năng quản lý nhiều loại sâu hại trên nhiều loại cây trồng khác nhau.
Quy cách đóng gói: 40ml
Cơ chế tác động
PLINAZOLIN® thuộc nhóm 30 (cơ chế tác động đột phá), tấn công vào kênh tiếp nhận GABA tại vị trí mới trong hệ thần kinh, làm cơ của côn trùng co giật liên hồi, khiến côn trùng bại liệt rồi chết
Ưu thế vượt trội
Cơ chế tác động đột phá
DC – Công nghệ thành phẩm ưu việt
Công phá tính kháng trên nhiều loại sâu hại khó trừ
Chống rửa trôi hiệu quả
Hiệu quả cao, kéo dài, giảm số lần phun thuốc
Mang lại hiệu ứng cây khỏe và sự an toàn`,
  },
  {
    dbProductName: 'Karate 2.5EC',
    name: 'Karate 2.5EC',
    plantCrops: 'Lúa, lạc, đậu tương, cây điều',
    type: 'Thuốc trừ sâu',
    ingredients: 'Lambda-cyhalothrin',
    targetDiseases: 'Sâu cuốn lá, sâu cuốn lá, bọ trĩ, bọ xít, rầy nâu, sâu phao..',
    usageInstruction: null,
    description: `Sản phẩm có phổ phòng trừ rộng, chuyên trị chích hút và miệng nhai như sâu cuốn lá lúa, sâu phao, rầy nâu, sâu ăn lá, sâu xanh, sâu xanh da láng, sâu tơ, bọ trĩ, bọ xít, bọ xít muỗi…
Quy cách đóng gói: 250ml, 100ml
Ưu thế vượt trội
Phổ tác động rộng trên nhiều đối tượng cây trồng.
Hiệu quả tức thì – Giảm thiểu thiệt hại cho cây trồng.
Thấm sâu và được giữ lại giữa lớp sáp của cây trồng.
Chống rửa trôi hiệu quả.
Dễ dàng phối trộn.
Ít lần phun hơn, kinh tế hơn.`,
  },
  {
    // CSV: "Pexena® 20WG (Pexena Cốm)" -> DB: "Pexena 20WG"
    dbProductName: 'Pexena 20WG',
    name: 'Pexena 20WG',
    plantCrops: 'Lúa',
    type: 'Thuốc trừ sâu',
    ingredients: '20% Triflumezopyrim',
    targetDiseases: 'Rầy nâu',
    usageInstruction: 'Liều lượng khuyến cáo: 125g/ha',
    description: `Pexena 20WG (Pexena Cốm) sở hữu công nghệ thành phẩm tiên tiến nhất hiện nay với dạng cốm độc quyền từ Syngenta giúp tan nhanh không nghẹt béc. Không chỉ kiểm soát rầy nâu hiệu quả, Pexena 20WG (Pexena Cốm) còn mang đến sự tiện lợi cho nông dân từ công nghệ thành phẩm dạng cốm.
Cơ chế tác động: là thuốc đầu tiên có tác động ức chế cơ quan thụ cảm Nicotinicacetylcholine (nAChR) làm rầy đờ đẫn, bất hoạt, bại liệt, chết sạch cả lứa rầy.
Ưu thế vượt trội: Hoạt chất trừ rầy nâu thế hệ tiên tiến nhất.
Dạng cốm ưu việt.
Rầy chết nhanh sau 30 phút.
Hiệu lực kéo dài 21 ngày.
Diệt nhanh rầy ấu trùng và trưởng thành (rầy gối lứa).
An toàn thiên địch`,
  },
  {
    // CSV: "Selecron® 500EC" -> DB: "Selecron 500EC"
    dbProductName: 'Selecron 500EC',
    name: 'Selecron 500EC',
    plantCrops: 'Lúa, cà phê, bông vải',
    type: 'Thuốc trừ sâu',
    ingredients: '500g/L Profenofos.',
    targetDiseases: `Lúa: Sâu cuốn lá, Rầy xanh.
Bông vải: Rệp, bọ trĩ, Nhện đỏ, Sâu khoang, Sâu xanh
Cà phê: Rệp sáp`,
    usageInstruction: `Lúa (Sâu cuốn lá) 0.5 L/ha. Lượng nước phun 400 – 800 L/ha. Phun khi sâu hại chớm xuất hiện.
Lúa (Rầy xanh) 0.75 – 1.0 L/ha. Lượng nước phun 400 – 800 L/ha. Phun khi sâu hại chớm xuất hiện.
Bông vải (Rệp, bọ trĩ) 1.0 – 1.5 L/ha. Lượng nước phun 400 – 800 L/ha. Phun khi sâu hại chớm xuất hiện.
Bông vải (Nhện đỏ) 1.5 L/ha. Lượng nước phun 400 – 800 L/ha. Phun khi sâu hại chớm xuất hiện.
Bông vải (Sâu khoang) 1.5 – 2.0 L/ha. Lượng nước phun 400 – 800 L/ha. Phun khi sâu hại chớm xuất hiện.
Bông vải (Sâu xanh) 1.4 – 2.0 L/ha. Lượng nước phun 400 – 800 L/ha. Phun khi sâu hại chớm xuất hiện.
Cà phê (Rệp sáp) 0.2 – 0.3%. Phun ướt đều cây trồng khi mật độ rệp khoảng 5-7 con/ chùm quả`,
    description: `Selecron 500EC là thuốc trừ sâu có khả năng tác động mạnh lên nhóm côn trùng cả nhai gặm lẫn chích hút, phổ tác dụng rộng diệt được nhiều sâu hại cùng lúc.
Ưu thế vượt trội:
Cơ chế chuyên biệt: tiếp xúc vị độc - xông hơi mạnh -> hiệu quả nhanh với hiệu lực kéo dài
Thành phẩm nhủ dầu đặc biệt: tiếp xúc - với cơ chế thấm sâu và chuyển vị mạnh trong cây trồng
Cung cấp lân hữu cơ cho cây trồng - giúp cây xanh bóng trái.
Thuốc nền lý tưởng để pha trộn
Giải pháp bảo vệ cơi đọt non hiệu quả`,
  },
  {
    // CSV: "Tervigo 020SC" -> DB: "Tervigo 20SC" (020 vs 20)
    dbProductName: 'Tervigo 20SC',
    name: 'Tervigo 20SC',
    plantCrops: 'Cam, khoai tây, thanh long, hồ tiêu, cà phê',
    type: 'Thuốc trừ sâu',
    ingredients: 'Abamectin + Phức chất hữu cơ chelate sắt.',
    targetDiseases: 'Tuyến trùng và tuyến trùng rễ',
    usageInstruction: `Liều dùng 5-6 lít/ha.
Tưới đất phòng tuyến trùng: 2 lần vào đầu và cuối mùa mưa.
Tưới trị tuyến trùng bằng 2 lần xử lý liên tiếp cách nhau 20-25 ngày.
Liều lượng sử dụng cụ thể tùy theo loại cây trồng:
Trên sầu riêng: pha100ml Tervigo 20SC + thuốc trừ nấm tưới cho 2-3 gốc ≥ 4 năm tuổi và 20ml Tervigo 20SC + thuốc trừ nấm tưới cho cây 4 năm tuổi.
Trên thanh long: pha 250ml Tervigo + thuốc trừ nấm tưới 30-50 trụ tùy vào tuổi cây.`,
    description: `Giải pháp Tervigo 20SC kiểm soát tuyến trùng tối ưu, giúp mang trở lại bộ rễ khỏe, tạo các cơi đọt mới và sung sức trở lại.
Quy cách đóng gói: 500ml, 100ml`,
  },
  {
    dbProductName: 'Virtako 40WG',
    name: 'Virtako 40WG',
    plantCrops: 'Lúa, ngô',
    type: 'Thuốc trừ sâu',
    ingredients: 'Chlorantraniliprole + Thiamethoxam',
    targetDiseases: 'Sâu cuốn lá, sâu đục thân, rầy nâu, rầy lưng trắng, rệp',
    usageInstruction: `Phun sớm cắt ngay lứa sâu đầu tiên, tránh bộc phát lứa sâu gối lứa.
Cơ chế tác động chuyên biệt lên hệ cơ và hệ thần kinh của sâu hại → tránh hình thành tính kháng chéo.`,
    description: `Sản phẩm cho hiệu quả cao trong kiểm soát và cắt lứa sâu với cơ chế tác động độc đáo và khả năng lưu dẫn vượt trội.
Quy cách đóng gói: 1.5g, 3g, 4.5g
Ưu thế vượt trội
Phun sớm cắt ngay lứa sâu đầu tiên, tránh bộc phát lứa sâu gối lứa.
Cơ chế tác động chuyên biệt lên hệ cơ và hệ thần kinh của sâu hại → tránh hình thành tính kháng chéo.
Đặc trị cả sâu cuốn lá và sâu đục thân.
Sâu ngừng ăn sau 2 giờ nhiễm thuốc - Hiệu lực lưu dẫn mạnh mẽ kéo dài
Thuốc có nguồn gốc thiên nhiên – an toàn con người thiên địch và môi trường.`,
  },
];

async function main() {
  console.log('Fetching existing products from database...');
  const products = await prisma.product.findMany({
    select: { id: true, name: true },
  });

  // Build a map of product name -> id
  const productMap = new Map<string, string>();
  for (const p of products) {
    productMap.set(p.name, p.id);
  }

  console.log(`Found ${products.length} products in database.`);
  console.log(`Prepared ${productDetailsData.length} product details to insert.\n`);

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const detail of productDetailsData) {
    const productId = productMap.get(detail.dbProductName);
    if (!productId) {
      console.log(`⚠️  SKIPPED: No matching product found for "${detail.dbProductName}"`);
      skipped++;
      continue;
    }

    try {
      await prisma.productDetail.create({
        data: {
          productId,
          name: detail.name,
          plantCrops: detail.plantCrops,
          type: detail.type,
          ingredients: detail.ingredients,
          targetDiseases: detail.targetDiseases,
          usageInstruction: detail.usageInstruction,
          description: detail.description,
        },
      });
      console.log(`✅ Inserted detail for: ${detail.name}`);
      inserted++;
    } catch (err: any) {
      console.log(`❌ ERROR for "${detail.name}": ${err.message}`);
      errors.push(`${detail.name}: ${err.message}`);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('Error details:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // Verify
  const finalCount = await prisma.productDetail.count();
  console.log(`\nTotal product_details in DB: ${finalCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
