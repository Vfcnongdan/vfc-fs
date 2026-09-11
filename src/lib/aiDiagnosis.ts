import { prisma } from "@/lib/prisma";
import { getCropOptionByType } from "@/lib/cropOptions";
import { DiagnosisStatus } from "@prisma/client";
import { eqStr } from "@/lib/utils";
import {
  getDiagnosisProducts,
  findProductByAiName,
} from "@/services/productCacheDiagnosis";
import { logger } from "@/lib/logger";

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
      ? `\nDanh sách mức độ bệnh hợp lệ: ${JSON.stringify(allowedSeverityLevels)}. Hãy đánh giá mức độ bệnh trong ảnh và trả về chính xác một trong các giá trị trên vào trường "detectedSeverityLevel". Nếu không xác định được, trả null.`
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
    const matched = allowedSeverityLevels.find(
      (s) => eqStr(s, parsed.detectedSeverityLevel)
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

function buildDiagnosisPromptText(cropType?: string) {
  return `Bạn là chuyên gia nông nghiệp của VFC. Hãy phân tích hình ảnh cây trồng của nông dân${cropType ? ` (loại: ${cropType})` : ""} và tham khảo danh mục bệnh/giải pháp được cung cấp để:
1. Đưa ra chẩn đoán chuyên môn chính xác về tên bệnh (loại nấm, vi khuẩn hoặc sâu hại gây bệnh), mức độ nghiêm trọng.
2. Đề xuất hướng xử lý kỹ thuật rõ ràng, thiết thực và hữu ích cho bà con nông dân.
3. Trích xuất CHÍNH XÁC tên các sản phẩm phù hợp từ danh mục giải pháp tham khảo và phân chia chúng thành các "bộ giải pháp" tương ứng nếu có nhiều lựa chọn (chữ "hoặc", "luân phiên"). Nếu "Không phun" hoặc không có sản phẩm phù hợp, để rỗng mảng.

QUY TẮC QUAN TRỌNG VỀ NỘI DUNG TRẢ VỀ:
- TUYỆT ĐỐI KHÔNG nhắc đến các cụm từ nội bộ như "dữ liệu của VFC", "dữ liệu tham khảo của VFC", "tài liệu VFC", "trong tài liệu VFC là...", "hệ thống không có dữ liệu/giải pháp"... trong bất kỳ trường thông tin nào (disease, summary, reasons, vfcSolutionText).
- Luôn trả lời trực tiếp với tư cách một chuyên gia nông nghiệp đang tư vấn cho nông dân. Nếu bệnh chưa có phác đồ cụ thể trong danh mục tham khảo, hãy trực tiếp đưa ra hướng dẫn canh tác/xử lý chung và khuyên bà con liên hệ kỹ sư nông nghiệp VFC để được tư vấn, TUYỆT ĐỐI KHÔNG giải thích là "VFC không có tài liệu/dữ liệu".
- Tên bệnh ("disease") chỉ ghi tên bệnh rõ ràng, không kèm chú thích so sánh với tài liệu nội bộ.

Trả về kết quả dưới dạng JSON thuần túy (không có markdown) với format: 
{ 
  "disease": "tên bệnh", 
  "severity": "mức độ bệnh", 
  "summary": "tóm tắt ngắn gọn hướng xử lý chuyên môn", 
  "confidence": 0.9,
  "vfcSolutionText": "Câu giải pháp điều trị",
  "solutionSets": [
    { "name": "Tên bộ giải pháp (ví dụ: Bộ 1, Bộ luân phiên...)", "products": ["tên sản phẩm 1", "tên sản phẩm 2"] }
  ],
  "reasons": { "tên sản phẩm 1": "công dụng rõ ràng của sản phẩm đối với tình trạng cây" }
}`;
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

  // Query dữ liệu đối chứng từ DB — thu hẹp dần theo từng tiêu chí có sẵn
  const baseWhere = {
    cropType: { equals: cropType, mode: "insensitive" as const },
    growthStage: { equals: growthStage, mode: "insensitive" as const },
  };

  let relevantDiseases = await prisma.planStageDisease.findMany({ where: baseWhere });

  // Nếu detect được pestDisease → lọc tiếp, chỉ fallback nếu kết quả rỗng
  if (pestDisease) {
    const filtered = await prisma.planStageDisease.findMany({
      where: { ...baseWhere, pestDisease: { equals: pestDisease, mode: "insensitive" } },
    });
    if (filtered.length > 0) relevantDiseases = filtered;
  }

  // Nếu detect được severityLevel → lọc tiếp, chỉ fallback nếu kết quả rỗng
  if (severityLevel) {
    const pestWhere = pestDisease
      ? { ...baseWhere, pestDisease: { equals: pestDisease, mode: "insensitive" as const } }
      : baseWhere;
    const filtered = await prisma.planStageDisease.findMany({
      where: { ...pestWhere, severityLevel: { equals: severityLevel, mode: "insensitive" } },
    });
    if (filtered.length > 0) relevantDiseases = filtered;
  }

  logger.info(
    `[AI Diagnosis Reference Data] ID: ${diagnosisId}, matched ${relevantDiseases.length} reference records`
  );
  logger.info(
    `[AI Diagnosis Filter] ID: ${diagnosisId} | Crop: ${cropType} | Stage: ${growthStage} | Pest: ${pestDisease ?? "any"} | Severity: ${severityLevel ?? "any"} -> ${relevantDiseases.length} records`
  );

  if (relevantDiseases.length > MAX_REFERENCE_ITEMS) {
    logger.warn(
      `[AI Diagnosis Too Many References] ID: ${diagnosisId}, ${relevantDiseases.length} records -> randomly sampling ${MAX_REFERENCE_ITEMS}`
    );
    relevantDiseases = relevantDiseases
      .sort(() => Math.random() - 0.5)
      .slice(0, MAX_REFERENCE_ITEMS);
  }

  const prompt = buildDiagnosisPromptText(cropType);

  try {
    const referenceData: ReferenceData[] = [];
    for (const d of relevantDiseases) {
      let b64 = null;
      if (d.imageUrls && d.imageUrls.length > 0) {
        b64 = await fetchAndOptimizeImage(d.imageUrls[0]);
      }
      const text = `- Bệnh: ${d.detail} (${d.pestDisease})\n- Mức độ: ${d.severityLevel}\n- Mô tả: ${d.description}\n- Giải pháp điều trị: ${d.vfcSolution}`;
      referenceData.push({ text, base64Image: b64 });
    }

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

    await prisma.plantDiagnosis.update({
      where: { id: diagnosisId },
      data: {
        rawAiResponse: parsed,
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
