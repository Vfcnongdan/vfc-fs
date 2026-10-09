import { prisma } from "@/lib/prisma";
import { getCropOptionByType } from "@/lib/cropOptions";
import { DiagnosisStatus } from "@prisma/client";
import { eqStr } from "@/lib/utils";
import {
  getDiagnosisProducts,
  findProductByAiName,
} from "@/services/productCacheDiagnosis";
import { logger } from "@/lib/logger";
import { selectDiverseImages, mapConcurrent } from "@/lib/referenceSampler";
import { aggregateDiseases } from "@/lib/diseaseAggregator";
import { uploadProblematicDiagnosisToDrive } from "@/lib/googleDriveSync";

type AiProvider = "gemini" | "openrouter";

export type ImageValidationReasonCode =
  | "VALID"
  | "NOT_A_PLANT"
  | "WRONG_CROP"
  | "BLURRY_IMAGE";

export type ImageValidationResponse = {
  isValid: boolean;
  reasonCode: ImageValidationReasonCode;
  userGuidance: string;
  /** Giai đoạn phát hiện từ ảnh — khớp với cropGrowthStageOptions, null nếu không xác định */
  detectedGrowthStage: string | null;
  /** Loại dịch hại phát hiện từ ảnh — khớp với cropGrowthStageOptions.pestDiseases, null nếu không xác định */
  detectedPestDisease: string | null;
  /** Mức độ bệnh phát hiện từ ảnh — khớp với cropGrowthStageOptions.severityLevels, null nếu không xác định */
  detectedSeverityLevel: string | null;
  /** Thông tin chi tiết về cây thực tế khi reasonCode = WRONG_CROP, null cho các trường hợp khác */
  plantInfo: string | null;
};

export type AiDiagnosisResponse = {
  disease?: string;
  severity?: string;
  growthStage?: string | null;
  summary?: string;
  confidence?: number;
  vfcSolutionText?: string;
  solutionSets?: { name: string; products: string[] }[];
  suggestedProducts?: string[];
  reasons?: Record<string, string>;
  aiProvider?: AiProvider;
  fallbackFrom?: AiProvider;
  /** Đánh dấu đang chờ user chọn giai đoạn */
  awaitingStage?: boolean;
  /** Danh sách giai đoạn có thể chọn */
  availableStages?: string[];
};

type GeminiContentPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: "image/jpeg" } };
type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type ReferenceData = { text: string; base64Image?: string | null };

const MAX_REFERENCE_ITEMS = 7;
const DIAGNOSIS_TIMEOUT_MS = 90_000;
export const NEED_CLEARER_IMAGE_MESSAGE =
  "Ảnh hiện tại chưa đủ rõ để hệ thống khoanh vùng chính xác. Bạn vui lòng chụp lại ảnh rõ hơn, gần vùng bệnh hơn và đủ ánh sáng nhé.";

const INVALID_IMAGE_GUIDANCE: Record<
  Exclude<ImageValidationReasonCode, "VALID">,
  string
> = {
  NOT_A_PLANT:
    "Hệ thống không nhận diện được cây trồng trong ảnh. Vui lòng chụp rõ phần lá hoặc thân cây bị bệnh.",
  WRONG_CROP:
    "Ảnh chụp có vẻ không phải là cây trồng. Vui lòng kiểm tra lại loại cây bạn đã chọn.",
  BLURRY_IMAGE:
    "Ảnh chụp bị mờ hoặc chưa thể hiện rõ đặc điểm nhận diện của cây (như toàn bộ phiến lá, đọt non, hoa hoặc quả). Bạn vui lòng lùi camera ra một chút để lấy trọn vẹn đặc điểm cây, hoặc chụp lại ở nơi đủ ánh sáng nhé.",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export async function fetchAndOptimizeImage(rawUrl: string): Promise<string | null> {
  try {
    let url = rawUrl.trim().replace(/^\{|\}$|^\[|\]$/g, '').replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim();

    // Chuyển đổi Google Drive share/view links → direct download link
    if (url.includes('drive.google.com')) {
      // https://drive.google.com/file/d/<ID>/view... → https://lh3.googleusercontent.com/d/<ID>
      const fileMatch = url.match(/\/file\/d\/([^/?\s]+)/);
      if (fileMatch) {
        url = `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
      } else {
        // https://drive.google.com/uc?id=<ID> or https://drive.google.com/uc?export=download&id=<ID>
        const ucMatch = url.match(/[?&]id=([^&\s]+)/);
        if (ucMatch) {
          url = `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
        }
      }
    }

    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const sharp = (await import("sharp")).default;
    const buffer = await sharp(Buffer.from(arrayBuffer))
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 60 })
      .toBuffer();
    return buffer.toString("base64");
  } catch (err) {
    logger.error("Failed to fetch/optimize ref image:", rawUrl, err);
    return null;
  }
}

function parseJsonBlock(text: string, provider: string) {
  // Strip <think>...</think> blocks từ các reasoning model trước khi parse
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.error(
      `[AI Parse Error] No JSON block found in ${provider} response. Raw text:`,
      text
    );
    throw new Error(`${provider} failed to return valid JSON`);
  }
  return JSON.parse(jsonMatch[0]);
}

class NeedsClearerImageError extends Error {
  constructor(message = NEED_CLEARER_IMAGE_MESSAGE) {
    super(message);
    this.name = "NeedsClearerImageError";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new NeedsClearerImageError());
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

// ─── Image Validation (OpenRouter) ───────────────────────────────────────────

function buildImageValidationPrompt(
  cropType: string | undefined,
  allowedStages: string[],
  allowedPestDiseases: string[],
  allowedSeverityLevels: string[]
): string {
  const stagesInfo =
    allowedStages.length > 0
      ? `\nDanh sách giai đoạn hợp lệ cho loại cây này: ${JSON.stringify(allowedStages)}. Hãy phát hiện giai đoạn sinh trưởng của cây trong ảnh và trả về chính xác một trong các giá trị trên vào trường "detectedGrowthStage". Nếu không xác định được, trả null.`
      : `\nKhông có danh sách giai đoạn cụ thể, trả "detectedGrowthStage": null.`;

  const pestDiseasesInfo =
    allowedPestDiseases.length > 0
      ? `\nDanh sách loại dịch hại hợp lệ: ${JSON.stringify(allowedPestDiseases)}. Hãy xác định loại dịch hại chính nhìn thấy trong ảnh và trả về chính xác một trong các giá trị trên vào trường "detectedPestDisease". Nếu không xác định được, trả null.`
      : `\nTrả "detectedPestDisease": null.`;

  const severityInfo =
    allowedSeverityLevels.length > 0
      ? `\nDanh sách mức độ bệnh hợp lệ: ${JSON.stringify(allowedSeverityLevels)}. Hãy đánh giá mức độ bệnh trong ảnh và trả về chính xác một trong các giá trị trên vào trường "detectedSeverityLevel" theo quy tắc LÀM TRÒN LÊN bên dưới. Nếu không xác định được, trả null.`
      : `\nTrả "detectedSeverityLevel": null.`;

  return `Bạn là một bộ lọc bảo mật và kiểm định chất lượng hình ảnh đầu vào cho ứng dụng nông nghiệp. Người dùng sẽ tải lên một bức ảnh và cho biết họ đang muốn kiểm tra cây gì (Tham số: target_crop: ${cropType || "không có thông tin"}).
Hãy phân tích bức ảnh về mặt chi tiết vết bệnh và trả về một đối tượng JSON duy nhất theo cấu trúc nghiêm ngặt sau:
{
  "isValid": true hoặc false,
  "reasonCode": "VALID" | "NOT_A_PLANT" | "WRONG_CROP" | "BLURRY_IMAGE",
  "userGuidance": "Chuỗi tiếng Việt hướng dẫn nông dân chụp lại nếu isValid là false, hoặc chuỗi trống nếu true",
  "cropConfidence": 0.0 đến 1.0 (mức độ tin cậy khi nhận diện loại cây trong ảnh),
  "detectedGrowthStage": "tên giai đoạn hoặc null",
  "detectedPestDisease": "loại dịch hại hoặc null",
  "detectedSeverityLevel": "mức độ bệnh hoặc null",
  "plantInfo": "Chuỗi tiếng Việt mô tả ngắn gọn về cây thực tế trong ảnh (khi WRONG_CROP và cropConfidence >= 0.9), hoặc null"
}

Quy tắc đánh giá cropConfidence:
- Chỉ trả cropConfidence >= 0.9 khi nhìn thấy rõ ít nhất 2 đặc điểm nhận diện đặc trưng của cây (hình thái phiến lá đầy đủ, cấu trúc thân/nhánh, hoa, quả, hoặc đọt non).
- Nếu ảnh chỉ thấy một phần lá, chỉ có đốm bệnh, hoặc không thấy được đặc điểm nhận diện đáng tin cậy, trả cropConfidence thấp (< 0.9).

Quy tắc đánh giá mức độ bệnh (detectedSeverityLevel) - LÀM TRÒN LÊN THEO THỰC TẾ CANH TÁC:
- Thứ tự mức độ nghiêm trọng tăng dần: "Không có" < "Nhẹ" < "Trung bình" < "Nặng" < "Hết cứu".
- Trong thực tế canh tác đồng ruộng, khi mắt thường/camera đã thấy rõ triệu chứng vết bệnh hoặc dịch hại trên một bộ phận lá, thân, quả thì áp lực dịch bệnh ngoài đồng ruộng thường đã lây lan nhanh và ở mức cao hơn so với một góc chụp cận cảnh. Nếu đánh giá quá nhẹ sẽ gây tâm lý chủ quan và chậm trễ thời điểm can thiệp thuốc BVTV của bà con nông dân.
- Do đó, BẮT BUỘC áp dụng nguyên tắc "LÀM TRÒN LÊN" (round up) mức độ nghiêm trọng hơn một bậc:
  + Nếu thấy triệu chứng vết bệnh (đốm lá, rỉ sắt, thán thư, cháy lá, thối nhũn, biến màu...) hoặc vết cắn phá của sâu bọ rõ ràng nhưng phân vân hoặc ở ngưỡng giữa "Nhẹ" và "Trung bình": BẮT BUỘC LÀM TRÒN LÊN chọn "Trung bình" (không chọn "Nhẹ").
  + Nếu triệu chứng bắt đầu lan rộng nhiều điểm, đốm lớn, mật độ sâu bệnh dày hoặc ở ngưỡng giữa "Trung bình" và "Nặng": BẮT BUỘC LÀM TRÒN LÊN chọn "Nặng".
  + Chỉ chọn "Nhẹ" khi tổn thương cực kỳ nhỏ, mờ nhạt, chỉ là vết xước hoặc lấm chấm đơn lẻ không có dấu hiệu lây lan.
  + Chỉ chọn "Không có" khi cây hoàn toàn khỏe mạnh, không có bất kỳ dấu vết sâu bệnh hại nào.

${stagesInfo}
${pestDiseasesInfo}
${severityInfo}

Nếu ảnh không chứa cây trồng, bộ phận của cây (lá, thân, rễ): isValid = false, reasonCode = "NOT_A_PLANT", userGuidance = "Hệ thống không nhận diện được cây trồng trong ảnh. Vui lòng chụp rõ phần lá hoặc thân cây bị bệnh.", cropConfidence = 0.0, detectedGrowthStage = null, plantInfo = null
Nếu ảnh là cây khác so với target_crop VÀ cropConfidence >= 0.9 (chắc chắn nhận diện được cây): isValid = false, reasonCode = "WRONG_CROP", userGuidance = "Thông tin dịch hại trên cây trồng bạn đưa không chính xác.", detectedGrowthStage = null, plantInfo = "Viết bằng tiếng Việt, ngắn gọn và thực dụng theo format sau, mỗi mục trên một dòng riêng:\n🌿 Cây nhận diện: <tên cây tiếng Việt>\n🔍 Tình trạng ghi nhận: <tóm tắt ngắn gọn tình trạng sức khỏe quan sát được trên lá/thân trong ảnh — khỏe mạnh, có dấu hiệu sâu bệnh, vàng lá, cháy bìa lá, v.v.>\n💡 Hướng xử lý tiếp theo: <nếu là cây phổ biến tại VN: gợi ý chọn lại danh mục cây phù hợp để nhận phác đồ VFC; nếu cây khác: gợi ý biện pháp canh tác cơ bản và liên hệ kỹ sư nông nghiệp VFC để được tư vấn>\nKhông bịa thông tin. Chỉ ghi những gì quan sát được từ ảnh."
Nếu ảnh là cây khác so với target_crop NHƯNG cropConfidence < 0.9 (không chắc chắn): isValid = false, reasonCode = "BLURRY_IMAGE", userGuidance = "Ảnh chụp chưa thể hiện rõ đặc điểm nhận diện của cây. Bạn vui lòng lùi camera ra một chút để lấy trọn vẹn đặc điểm cây, hoặc chụp lại ở nơi đủ ánh sáng nhé.", detectedGrowthStage = null, plantInfo = null
Nếu ảnh quá mờ, quá tối, quá sáng, chụp quá xa hoặc không thấy rõ đặc điểm nhận diện cây: isValid = false, reasonCode = "BLURRY_IMAGE", userGuidance = "Ảnh chụp bị mờ hoặc chưa thể hiện rõ đặc điểm nhận diện của cây. Bạn vui lòng lùi camera ra một chút để lấy trọn vẹn đặc điểm cây, hoặc chụp lại ở nơi đủ ánh sáng nhé.", cropConfidence = 0.0, detectedGrowthStage = null, plantInfo = null
Nếu ảnh hợp lệ và phù hợp với target_crop: isValid = true, reasonCode = "VALID", userGuidance = "", plantInfo = null`;
}

function parseImageValidationJson(
  text: string,
  cropType: string | undefined,
  allowedStages: string[],
  allowedPestDiseases: string[],
  allowedSeverityLevels: string[]
): ImageValidationResponse {
  const parsed = parseJsonBlock(text, "image-validation") as Partial<
    ImageValidationResponse & {
      detectedGrowthStage?: string | null;
      detectedPestDisease?: string | null;
      detectedSeverityLevel?: string | null;
      cropConfidence?: number | null;
    }
  >;

  if (typeof parsed.isValid !== "boolean") {
    throw new Error("Image validation returned invalid isValid value");
  }
  if (
    parsed.reasonCode !== "VALID" &&
    parsed.reasonCode !== "NOT_A_PLANT" &&
    parsed.reasonCode !== "WRONG_CROP" &&
    parsed.reasonCode !== "BLURRY_IMAGE"
  ) {
    throw new Error("Image validation returned invalid reasonCode value");
  }
  if (typeof parsed.userGuidance !== "string") {
    throw new Error("Image validation returned invalid userGuidance value");
  }
  if (parsed.isValid && parsed.reasonCode !== "VALID") {
    throw new Error(
      "Image validation returned inconsistent isValid and reasonCode"
    );
  }
  if (!parsed.isValid && parsed.reasonCode === "VALID") {
    throw new Error(
      "Image validation returned inconsistent invalid VALID response"
    );
  }

  // Validate detectedGrowthStage — must be in allowedStages or null
  let detectedGrowthStage: string | null = null;
  if (parsed.isValid && parsed.detectedGrowthStage) {
    const matched = allowedStages.find(
      (s) => eqStr(s, parsed.detectedGrowthStage)
    );
    if (matched) {
      detectedGrowthStage = matched;
    } else {
      logger.warn(
        `[AI Validation] detectedGrowthStage "${parsed.detectedGrowthStage}" not found in allowedStages:`,
        allowedStages
      );
    }
  }

  // Validate detectedPestDisease
  let detectedPestDisease: string | null = null;
  if (parsed.isValid && parsed.detectedPestDisease) {
    const matched = allowedPestDiseases.find(
      (s) => eqStr(s, parsed.detectedPestDisease)
    );
    if (matched) {
      detectedPestDisease = matched;
    } else {
      logger.warn(
        `[AI Validation] detectedPestDisease "${parsed.detectedPestDisease}" not found in allowedPestDiseases:`,
        allowedPestDiseases
      );
    }
  }

  // Validate detectedSeverityLevel
  let detectedSeverityLevel: string | null = null;
  if (parsed.isValid && parsed.detectedSeverityLevel) {
    const rawSev = parsed.detectedSeverityLevel.trim();
    const matched =
      allowedSeverityLevels.find((s) => eqStr(s, rawSev)) ||
      allowedSeverityLevels.find(
        (s) =>
          rawSev.toLowerCase().includes(s.toLowerCase()) ||
          s.toLowerCase().includes(rawSev.toLowerCase())
      );
    if (matched) {
      detectedSeverityLevel = matched;
    } else {
      logger.warn(
        `[AI Validation] detectedSeverityLevel "${parsed.detectedSeverityLevel}" not found in allowedSeverityLevels:`,
        allowedSeverityLevels
      );
    }
  }

  if (parsed.isValid) {
    return {
      isValid: true,
      reasonCode: "VALID",
      userGuidance: "",
      detectedGrowthStage,
      detectedPestDisease,
      detectedSeverityLevel,
      plantInfo: null,
    };
  }

  // Safety net: WRONG_CROP nhưng không đủ tin cậy → chuyển thành BLURRY_IMAGE
  if (parsed.reasonCode === "WRONG_CROP") {
    const confidence = typeof parsed.cropConfidence === "number" ? parsed.cropConfidence : 0;
    if (confidence < 0.9 || !parsed.plantInfo?.trim()) {
      logger.warn(
        `[AI Validation] WRONG_CROP with low confidence (${confidence}) or missing plantInfo — fallback to BLURRY_IMAGE`
      );
      return {
        isValid: false,
        reasonCode: "BLURRY_IMAGE",
        userGuidance: INVALID_IMAGE_GUIDANCE.BLURRY_IMAGE,
        detectedGrowthStage: null,
        detectedPestDisease: null,
        detectedSeverityLevel: null,
        plantInfo: null,
      };
    }
  }

  const fallbackGuidance =
    parsed.reasonCode === "WRONG_CROP"
      ? INVALID_IMAGE_GUIDANCE.WRONG_CROP.replace(
          "cây trồng",
          cropType || "cây trồng"
        )
      : parsed.reasonCode === "NOT_A_PLANT"
        ? INVALID_IMAGE_GUIDANCE.NOT_A_PLANT
        : INVALID_IMAGE_GUIDANCE.BLURRY_IMAGE;

  // Extract plantInfo for WRONG_CROP — AI trả mô tả ngắn gọn cây thực tế
  const plantInfo =
    parsed.reasonCode === "WRONG_CROP" && typeof parsed.plantInfo === "string"
      ? parsed.plantInfo.trim() || null
      : null;

  return {
    isValid: false,
    reasonCode: parsed.reasonCode,
    userGuidance: parsed.userGuidance.trim() || fallbackGuidance,
    detectedGrowthStage: null,
    detectedPestDisease: null,
    detectedSeverityLevel: null,
    plantInfo,
  };
}

export async function validateImagesWithGroq(
  base64Images: string[],
  cropType?: string
): Promise<ImageValidationResponse> {
  const apiKey =
    process.env.OPENROUTER_API_VALIDATION_KEY || process.env.OPENROUTER_API_KEY;
  const hasApiKey = !!apiKey;
  logger.info(
    `[AI Plan Validation OpenRouter API Key Check] Key exists: ${hasApiKey}`
  );
  if (!hasApiKey) {
    throw new Error(
      "OPENROUTER_API_VALIDATION_KEY is not defined in environment variables"
    );
  }

  const cropOption = await getCropOptionByType(cropType);
  const allowedStages = cropOption?.growthStages ?? [];
  const allowedPestDiseases = cropOption?.pestDiseases ?? [];
  const allowedSeverityLevels = cropOption?.severityLevels ?? [];

  const content: OpenAIContentPart[] = [
    {
      type: "text",
      text: buildImageValidationPrompt(cropType, allowedStages, allowedPestDiseases, allowedSeverityLevels),
    },
  ];

  for (let idx = 0; idx < base64Images.length; idx++) {
    const base64Data = base64Images[idx];
    logger.info(
      `[AI Plan Validation Payload] Image ${idx} size: ${((base64Data.length * 0.75) / 1024).toFixed(2)} KB`
    );
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${base64Data}` },
    });
  }

  const model =
    process.env.OPENROUTER_VISION_MODEL ||
    "meta-llama/llama-3.2-11b-vision-instruct:free";
  logger.info(
    `[AI Plan Validation API Call] Sending request to OpenRouter (${model})...`
  );

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "https://vfc.vn",
      "X-Title": "VFC Farmer Portal",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  const responseText = await res.text();
  const data = JSON.parse(responseText || "{}");
  if (!res.ok) {
    throw new Error(
      `OpenRouter plan validation API failed with ${res.status}: ${JSON.stringify(data)}`
    );
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("OpenRouter plan validation API returned an empty response");
  }

  logger.info(
    `[AI Plan Validation Response] Text length: ${text.length}\nRaw text:`, text
  );
  return parseImageValidationJson(text, cropType, allowedStages, allowedPestDiseases, allowedSeverityLevels);
}

// ─── AI Diagnosis Runners ────────────────────────────────────────────────────

function buildDiagnosisPromptText(cropType?: string, availableStages?: string[]) {
  const stagesHint =
    availableStages && availableStages.length > 0
      ? `\n- Giai đoạn sinh trưởng chuẩn của cây ${cropType || ""}: ${availableStages.join(", ")}.`
      : "";

  return `Bạn là chuyên gia nông nghiệp hàng đầu của VFC. Hãy phân tích hình ảnh cây trồng của nông dân${cropType ? ` (loại cây: ${cropType})` : ""} và đối chiếu khách quan với danh mục bệnh/giải pháp tham khảo được cung cấp để:
1. Trả về tên bệnh hoặc triệu chứng lâm sàng thực tế quan sát được bằng mắt thường trên cây trồng. BẮT BUỘC dùng tên gọi bình dân, mộc mạc, thuần Việt; TUYỆT ĐỐI KHÔNG dùng tên khoa học, danh pháp tiếng Anh/Latinh hay từ ngữ mang tính bệnh học bác học, hàn lâm dễ bị bắt bẻ chuyên môn.
2. Nhận diện giai đoạn sinh trưởng hiện tại của cây trồng từ hình ảnh trực quan (lá, thân, cành, nụ/hoa, trái, hạt...) hoặc suy luận từ tính chất tổn thương thực tế.
3. Đề xuất hướng xử lý kỹ thuật rõ ràng, thiết thực và hữu ích cho bà con nông dân.
4. Trích xuất tên các sản phẩm VFC phù hợp nếu bệnh thực sự trùng khớp với danh mục tham chiếu.

QUY TẮC CỐT LÕI VỀ CHẨN ĐOÁN & ĐỐI CHIẾU DANH MỤC THAM KHẢO (CHỐNG GƯỢNG ÉP BỆNH):
- QUY TẮC TRẢ VỀ TÊN BỆNH / TRIỆU CHỨNG LÂM SÀNG THỰC TẾ ("disease"):
  + TRƯỜNG HỢP 1 - BỆNH LẠ / TRIỆU CHỨNG NGOÀI DANH MỤC / CHƯA RÕ NGUYÊN NHÂN (sinh lý, thời tiết, thiếu chất, sâu hại mới...):
    * BẮT BUỘC trả về TÊN TRIỆU CHỨNG BÌNH DÂN, MỘC MẠC, THUẦN VIỆT theo đúng đặc điểm mắt thường quan sát được trên lá/thân/trái/rễ.
    * Ví dụ chuẩn: "Triệu chứng cháy chóp lá", "Triệu chứng đốm vàng loang lổ", "Triệu chứng đốm mắt cua", "Triệu chứng vàng lá sọc dưa", "Triệu chứng xoăn đọt non", "Triệu chứng héo xanh rũ ngọn", "Triệu chứng lở cổ rễ", "Triệu chứng cắn phá của sâu lạ", "Triệu chứng thối nhũn bẹ", "Triệu chứng sọc nâu lạ"...
    * TUYỆT ĐỐI KHÔNG dùng tên khoa học / danh pháp tiếng Anh hoặc Latinh (như Magnaporthe, Pyricularia, Rhizoctonia, Xanthomonas, Fusarium, Colletotrichum, Cercospora...).
    * TUYỆT ĐỐI KHÔNG dùng từ ngữ mang tính bệnh học bác học, hàn lâm, đao to búa lớn (như "hoại tử biểu bì mô tế bào", "rối loạn sắc tố diệp lục", "thoái hóa mạch dẫn vascular", "suy giảm áp suất thẩm thấu", "tổn thương nhu mô lá"...).
      -> LÝ DO: Ảnh chụp điện thoại ngoài đồng ruộng không thể thay thế xét nghiệm vi sinh trong phòng thí nghiệm; nếu phỏng đoán bằng thuật ngữ bác học hàn lâm thì nông dân không hiểu mà còn rất dễ bị các kỹ sư nông nghiệp hoặc bà con bắt bẻ, phản bác chuyên môn!
    * KÊ TOA THẾ NÀO KHI GẶP TRƯỜNG HỢP NÀY?
      - "solutionSets": BẮT BUỘC để mảng RỖNG [] (không được bịa thuốc hoặc lấy thuốc của bệnh khác).
      - "reasons": BẮT BUỘC để đối tượng rỗng {}.
      - "vfcSolutionText": Ghi rõ hướng dẫn: "Hiện chưa có phác đồ điều trị đặc hiệu trong danh mục VFC cho triệu chứng này. Khuyến cáo bà con liên hệ trực tiếp kỹ sư nông nghiệp VFC để kiểm tra mẫu thực tế ngoài đồng ruộng."
      - "confidence": BẮT BUỘC đánh giá THẤP trong khoảng 0.30 đến 0.55 (dưới 0.6) để hệ thống tự động ghi nhận và đồng bộ lưu trữ.

  + TRƯỜNG HỢP 2 - BỆNH TRÙNG KHỚP RÕ RÀNG VỚI DANH MỤC THAM KHẢO VFC (>80%):
    * "disease": BẮT BUỘC dùng TÊN BỆNH TIẾNG VIỆT PHỔ THÔNG, DÂN DÃ, QUEN THUỘC theo đúng danh mục VFC (ví dụ: Bệnh đạo ôn lá, Bệnh thán thư, Bệnh đốm vằn, Bệnh lem lép hạt, Sâu cuốn lá, Rầy nâu...). TUYỆT ĐỐI KHÔNG kèm tên Latinh hay biệt ngữ học thuật.
    * "solutionSets": Trích xuất chính xác tên các sản phẩm VFC từ mục 'Giải pháp VFC' của mẫu tham chiếu tương ứng và phân chia thành các bộ giải pháp.
    * "reasons": Giải thích công dụng thực tế của từng sản phẩm.
    * "confidence": Đánh giá từ 0.75 đến 0.95 tùy theo độ điển hình của vết bệnh.

- TUYỆT ĐỐI KHÔNG "CỐ ĐẤM ĂN XÔI" GƯỢNG ÉP: Nếu triệu chứng trên ảnh KHÔNG TRÙNG KHỚP RÕ RÀNG với bất kỳ mẫu nào trong danh mục tham chiếu, TUYỆT ĐỐI KHÔNG ĐƯỢC gán ghép bừa vào một bệnh gần giống để có thuốc kê toa.

- THANG ĐO ĐỘ TIN CẬY (CONFIDENCE CALIBRATION) NGHIÊM NGẶT:
  + >= 0.80: Vết hại rất điển hình, khớp rõ nét với mô tả bệnh học và ảnh đối chứng trong danh mục VFC.
  + 0.60 - 0.79: Khớp một phần với bệnh trong danh mục VFC nhưng biểu hiện còn mờ nhạt hoặc ở giai đoạn chớm nở.
  + < 0.60 (0.30 - 0.55): Bệnh lạ ngoài danh mục, triệu chứng không rõ ràng, nghi ngờ nhiều nguyên nhân (sinh lý/thiếu chất), hoặc không có đối chứng tương ứng trong danh mục VFC.

- NGUYÊN TẮC NGÔN NGỮ KHUYẾN NÔNG & ĐÁNH GIÁ MỨC ĐỘ:
  + CẤU TRÚC PHẦN "summary": Trình bày ngắn gọn, gãy gọn: [Tên bệnh hoặc tên triệu chứng bình dân] + [Mức độ gây hại] + [Mô tả vết hại mắt thường nhìn thấy] + [Khuyến cáo kỹ thuật]. Giọng văn ấm áp, mộc mạc, thực tế, dứt khoát như kỹ sư VFC trực tiếp tư vấn trên ruộng. Tuyệt đối tránh thuật ngữ bác học hàn lâm trong mô tả.
  + Đánh giá mức độ bệnh ("severity"): Sát thực tế đồng ruộng ("Không có" | "Nhẹ" | "Trung bình" | "Nặng" | "Hết cứu"), ưu tiên làm tròn lên mức nghiêm trọng hơn để nông dân không chủ quan.
  + Giai đoạn sinh trưởng ("growthStage"): Nhận diện giai đoạn của cây dựa trên hình ảnh${stagesHint}.
  + TUYỆT ĐỐI KHÔNG nhắc đến các cụm từ nội bộ như "dữ liệu của VFC", "hệ thống không có dữ liệu", "trong tài liệu tham khảo là..." trong bất kỳ trường thông tin nào.

Trả về kết quả dưới dạng JSON thuần túy (không có markdown code block) với format:
{ 
  "disease": "Tên bệnh phổ thông (nếu khớp VFC) HOẶC Tên triệu chứng bình dân mắt thấy (nếu bệnh lạ/chưa rõ), KHÔNG dùng tên khoa học/thuật ngữ bác học", 
  "growthStage": "giai đoạn sinh trưởng phát hiện được từ ảnh hoặc null",
  "severity": "Không có | Nhẹ | Trung bình | Nặng | Hết cứu", 
  "summary": "tóm tắt ngắn gọn hướng xử lý chuyên môn bằng từ ngữ bình dân, dễ hiểu", 
  "confidence": 0.45,
  "vfcSolutionText": "Câu giải pháp điều trị (nếu không có thuốc thì hướng dẫn liên hệ kỹ sư VFC)",
  "solutionSets": [
    { "name": "Bộ giải pháp", "products": ["tên sản phẩm 1", "tên sản phẩm 2"] }
  ],
  "reasons": { "tên sản phẩm 1": "công dụng rõ ràng của sản phẩm đối với tình trạng cây" }
}
(Lưu ý: Giá trị "confidence" 0.45 ở trên chỉ là ví dụ minh họa, bạn BẮT BUỘC phải tự chấm điểm thực tế từ 0.0 đến 1.0 theo thang đo độ tin cậy đã nêu).`;
}

function parseAiJson(text: string, provider: AiProvider): AiDiagnosisResponse {
  return parseJsonBlock(text, provider);
}

async function analyzeWithGemini(
  prompt: string,
  userImages: string[],
  referenceData: ReferenceData[]
): Promise<AiDiagnosisResponse> {
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  logger.info(`[AI Diagnosis Gemini API Key Check] Key exists: ${hasApiKey}`);
  if (!hasApiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    generationConfig: { temperature: 0.1 },
  });

  const parts: GeminiContentPart[] = [
    { text: "Ảnh cây trồng của nông dân:" },
  ];
  for (const b64 of userImages) {
    parts.push({ inlineData: { data: b64, mimeType: "image/jpeg" } });
  }
  parts.push({ text: "\n\nDanh mục bệnh và giải pháp tham khảo:" });
  for (const ref of referenceData) {
    parts.push({ text: "\n" + ref.text });
    if (ref.base64Image) {
      parts.push({ inlineData: { data: ref.base64Image, mimeType: "image/jpeg" } });
    }
  }
  parts.push({ text: `\n\n${prompt}` });

  logger.info("[AI Diagnosis API Call] Sending request to Gemini API...");
  const result = await model.generateContent(parts);
  const text = result.response.text();
  logger.info(
    `[AI Diagnosis Gemini Response] Received response. Text length: ${text.length}\nRaw text:`, text
  );
  return parseAiJson(text, "gemini");
}

async function analyzeWithOpenRouter(
  prompt: string,
  userImages: string[],
  referenceData: ReferenceData[]
): Promise<AiDiagnosisResponse> {
  const hasApiKey = !!process.env.OPENROUTER_API_KEY;
  logger.info(`[AI Diagnosis OpenRouter API Key Check] Key exists: ${hasApiKey}`);
  if (!hasApiKey) {
    throw new Error("OPENROUTER_API_KEY is not defined in environment variables");
  }

  const content: OpenAIContentPart[] = [
    { type: "text", text: "Ảnh cây trồng của nông dân:" },
  ];
  for (const b64 of userImages) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${b64}` },
    });
  }
  content.push({ type: "text", text: "\n\nDanh mục bệnh và giải pháp tham khảo:" });
  for (const ref of referenceData) {
    content.push({ type: "text", text: "\n" + ref.text });
    if (ref.base64Image) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${ref.base64Image}` },
      });
    }
  }
  content.push({ type: "text", text: `\n\n${prompt}` });

  const model = process.env.OPENROUTER_MODEL || "google/gemini-flash-1.5";
  logger.info(`[AI Diagnosis API Call] Sending request to OpenRouter (${model})...`);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "https://vfc.vn",
      "X-Title": "VFC Farmer Portal",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });

  const responseText = await res.text();
  const data = JSON.parse(responseText || "{}");
  if (!res.ok) {
    throw new Error(
      `OpenRouter API failed with ${res.status}: ${JSON.stringify(data)}`
    );
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter API returned an empty response");

  logger.info(
    `[AI Diagnosis OpenRouter Response] Received response. Text length: ${text.length}\nRaw text:`, text
  );
  return parseAiJson(text, "openrouter");
}

async function analyzeWithFallback(
  prompt: string,
  userImages: string[],
  referenceData: ReferenceData[]
): Promise<AiDiagnosisResponse> {
  // 1st: Gemini
  try {
    logger.info("[AI Fallback] Trying Gemini...");
    const parsed = await analyzeWithGemini(prompt, userImages, referenceData);
    logger.info(`[AI Fallback] Gemini succeeded | Provider: gemini | Disease: ${parsed.disease} | Products: ${parsed.solutionSets?.length ?? 0} sets`);
    return { ...parsed, aiProvider: "gemini" };
  } catch (geminiError) {
    logger.error("[AI Fallback] Gemini failed, trying OpenRouter", geminiError);
  }

  // 2nd: OpenRouter
  logger.info("[AI Fallback] Trying OpenRouter...");
  const parsed = await analyzeWithOpenRouter(prompt, userImages, referenceData);
  logger.info(`[AI Fallback] OpenRouter succeeded | Provider: openrouter | Disease: ${parsed.disease} | Products: ${parsed.solutionSets?.length ?? 0} sets`);
  return { ...parsed, aiProvider: "openrouter", fallbackFrom: "gemini" };
}

export async function runAiDiagnosis(
  diagnosisId: string,
  base64Images: string[],
  cropType?: string,
  growthStage?: string,
  pestDisease?: string,
  severityLevel?: string
) {
  logger.info(
    `[AI Diagnosis Start] ID: ${diagnosisId}, Crop: ${cropType}, Stage: ${growthStage}, Pest: ${pestDisease ?? "any"}, Severity: ${severityLevel ?? "any"}`
  );

  const allProducts = await getDiagnosisProducts();

  // 1. Query toàn bộ bệnh của loại cây này (KHÔNG lọc cứng theo growthStage / severityLevel trong SQL)
  const rawDiseases = await prisma.planStageDisease.findMany({
    where: {
      cropType: cropType
        ? { equals: cropType, mode: "insensitive" as const }
        : undefined,
    },
  });

  logger.info(
    `[AI Diagnosis Reference Data] ID: ${diagnosisId} | Crop: ${cropType} | Total DB records: ${rawDiseases.length}`
  );

  // 2. Gom nhóm theo thực thể bệnh duy nhất & khử trùng lặp giải pháp VFC (In-Memory Aggregator)
  const aggregatedDiseases = aggregateDiseases(rawDiseases, growthStage);

  logger.info(
    `[Disease Aggregator] ID: ${diagnosisId} | Aggregated into ${aggregatedDiseases.length} unique diseases`
  );

  const maxRecords =
    parseInt(process.env.AI_MAX_REFERENCE_RECORDS || "40", 10);
  const maxImages =
    parseInt(process.env.AI_MAX_REFERENCE_IMAGES || "8", 10);
  const concurrency =
    parseInt(process.env.AI_IMAGE_CONCURRENCY || "3", 10);

  const targetDiseases =
    aggregatedDiseases.length > maxRecords
      ? aggregatedDiseases.slice(0, maxRecords)
      : aggregatedDiseases;

  // 3. Chọn các mẫu ảnh đại diện bằng Diversity Sampling (Round-Robin)
  const recordsToFetchImages = selectDiverseImages(targetDiseases, maxImages);

  logger.info(
    `[Diversity Sampling] Diagnosis: ${diagnosisId} | Selected ${recordsToFetchImages.length}/${targetDiseases.length} diverse reference images`
  );

  const cropOption = await getCropOptionByType(cropType);
  const prompt = buildDiagnosisPromptText(cropType, cropOption?.growthStages);

  try {
    // 4. Tải và tối ưu ảnh song song có kiểm soát concurrency (mặc định 3 luồng)
    const imageMap = new Map<string, string>();
    await mapConcurrent(recordsToFetchImages, concurrency, async (record) => {
      if (record.imageUrls && record.imageUrls.length > 0) {
        const b64 = await fetchAndOptimizeImage(record.imageUrls[0]);
        if (b64) {
          imageMap.set(record.id, b64);
        }
      }
    });

    // 5. Cấu trúc referenceData sạch sẽ, tinh gọn (~3.500 tokens)
    const referenceData: ReferenceData[] = targetDiseases.map((d, index) => {
      const b64 = imageMap.get(d.id) || null;
      const hasImgNotice = b64
        ? " [CÓ ẢNH ĐỐI CHỨNG ĐÍNH KÈM BÊN DƯỚI]"
        : " [CHỈ THAM KHẢO MÔ TẢ TRIỆU CHỨNG VĂN BẢN]";
      const pestNotice = d.pestDisease ? ` (${d.pestDisease})` : "";
      const stagesNotice =
        d.stagesCovered && d.stagesCovered.length > 0
          ? `\n- Giai đoạn thường gặp: ${d.stagesCovered.join(", ")}`
          : "";
      const text = `[Mẫu tham chiếu #${index + 1}${hasImgNotice}]\n- Bệnh: ${d.detail}${pestNotice}${stagesNotice}\n- Triệu chứng nhận diện: ${d.description}\n- Giải pháp VFC:\n  ${d.vfcSolution}`;
      return { text, base64Image: b64 };
    });

    const parsed = await withTimeout(
      analyzeWithFallback(prompt, base64Images, referenceData),
      DIAGNOSIS_TIMEOUT_MS
    );

    const validProductIds: string[] = [];
    const reasonsMap: Record<string, string> = {};

    const extractedProducts =
      parsed.solutionSets?.flatMap((s) => s.products) ||
      parsed.suggestedProducts ||
      [];
    for (const pName of extractedProducts) {
      const product = await findProductByAiName(pName);
      if (product && !validProductIds.includes(product.id)) {
        validProductIds.push(product.id);
        reasonsMap[product.id] =
          parsed.reasons?.[pName] ||
          `Phù hợp với triệu chứng: ${parsed.disease}`;
        logger.info(`[AI Diagnosis Product Match] ID: ${diagnosisId} | AI name: "${pName}" -> matched product: ${product.id} (${product.name})`);
      } else if (!product) {
        logger.warn(`[AI Diagnosis Product NOT Found] ID: ${diagnosisId} | AI name: "${pName}" not found in ${allProducts.length} active products`);
      }
    }

    // Xóa suggestions cũ nếu có (trường hợp chạy lại sau khi chọn stage)
    await prisma.diagnosisSuggestion.deleteMany({ where: { diagnosisId } });

    const finalAiResponse = {
      ...parsed,
      growthStage: parsed.growthStage || growthStage || null,
    };

    await prisma.plantDiagnosis.update({
      where: { id: diagnosisId },
      data: {
        rawAiResponse: finalAiResponse,
        summary: parsed.summary,
        confidence: parsed.confidence,
        status: DiagnosisStatus.DONE,
        suggestions: {
          create: validProductIds.map((pid, i) => ({
            productId: pid,
            reason: reasonsMap[pid] || "",
            rank: i + 1,
          })),
        },
      },
    });

    logger.info(`[AI Diagnosis Success] ID: ${diagnosisId}`);

    // ─── Đồng bộ ca bệnh có vấn đề lên Google Drive (100% Async Non-blocking) ──
    const isNoSolution = validProductIds.length === 0;
    const isLowConfidence =
      typeof parsed.confidence === "number" && parsed.confidence < 0.6;

    if (
      (isNoSolution || isLowConfidence) &&
      base64Images &&
      base64Images.length > 0
    ) {
      const caseType = isNoSolution ? "NO_SOLUTION" : "LOW_CONFIDENCE";
      logger.info(
        `[Google Drive Trigger] Triggering background upload for ${diagnosisId} | Case: ${caseType}`
      );
      void uploadProblematicDiagnosisToDrive({
        diagnosisId,
        cropType,
        growthStage: finalAiResponse.growthStage || undefined,
        disease: parsed.disease || "Chưa xác định",
        confidence: parsed.confidence,
        caseType,
        summary: parsed.summary,
        base64Image: base64Images[0],
      }).catch((err) => {
        logger.error(
          `[Google Drive Trigger] Drive upload error for ${diagnosisId}: ${err.message}`
        );
      });
    }
  } catch (err) {
    logger.error(`[AI Diagnosis Error] ID: ${diagnosisId}`, err);
    const needsClearerImage = err instanceof NeedsClearerImageError;
    await prisma.plantDiagnosis.update({
      where: { id: diagnosisId },
      data: {
        rawAiResponse: needsClearerImage
          ? { reasonCode: "DIAGNOSIS_TIMEOUT" }
          : undefined,
        summary: needsClearerImage ? NEED_CLEARER_IMAGE_MESSAGE : undefined,
        status: DiagnosisStatus.FAILED,
      },
    });
  }
}
