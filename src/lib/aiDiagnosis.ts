import { prisma } from "@/lib/prisma";
import { cropGrowthStageOptions } from "@/lib/deseaseDetails";
import { DiagnosisStatus } from "@prisma/client";
import { eqStr, includesStr } from "@/lib/utils";

type AiProvider = "gemini" | "groq" | "openrouter";

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
type GroqContentPart =
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
    "Ảnh chụp bị mờ hoặc quá xa. Bạn vui lòng đưa camera lại gần vết bệnh trên cây (khoảng 20-30cm), giữ chắc tay và chụp lại nơi có đủ ánh sáng nhé.",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export async function fetchAndOptimizeImage(url: string): Promise<string | null> {
  try {
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
    console.error("Failed to fetch/optimize ref image:", url, err);
    return null;
  }
}

function parseJsonBlock(text: string, provider: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(
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

// ─── Image Validation (Groq) ─────────────────────────────────────────────────

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
  "detectedGrowthStage": "tên giai đoạn hoặc null",
  "detectedPestDisease": "loại dịch hại hoặc null",
  "detectedSeverityLevel": "mức độ bệnh hoặc null"
}
${stagesInfo}
${pestDiseasesInfo}
${severityInfo}

Nếu ảnh không chứa cây trồng, bộ phận của cây (lá, thân, rễ): isValid = false, reasonCode = "NOT_A_PLANT", userGuidance = "Hệ thống không nhận diện được cây trồng trong ảnh. Vui lòng chụp rõ phần lá hoặc thân cây bị bệnh.", detectedGrowthStage = null
Nếu ảnh là cây khác hoàn toàn so với target_crop: isValid = false, reasonCode = "WRONG_CROP", userGuidance = "Ảnh chụp có vẻ không phải là ${cropType || "cây trồng"}. Vui lòng kiểm tra lại loại cây bạn đã chọn.", detectedGrowthStage = null
Nếu ảnh quá mờ, quá tối, quá sáng, chụp quá xa: isValid = false, reasonCode = "BLURRY_IMAGE", userGuidance = "Ảnh chụp không rõ chi tiết vết bệnh. Bạn vui lòng đưa camera lại gần vết bệnh trên cây (khoảng 20-30cm), giữ chắc tay và chụp lại rõ vết bệnh nhé.", detectedGrowthStage = null
Nếu ảnh hợp lệ và phù hợp với target_crop: isValid = true, reasonCode = "VALID", userGuidance = ""`;
}

function parseImageValidationJson(
  text: string,
  cropType: string | undefined,
  allowedStages: string[],
  allowedPestDiseases: string[],
  allowedSeverityLevels: string[]
): ImageValidationResponse {
  const parsed = parseJsonBlock(text, "groq-plan-validation") as Partial<
    ImageValidationResponse & {
      detectedGrowthStage?: string | null;
      detectedPestDisease?: string | null;
      detectedSeverityLevel?: string | null;
    }
  >;

  if (typeof parsed.isValid !== "boolean") {
    throw new Error("Groq plan validation returned invalid isValid value");
  }
  if (
    parsed.reasonCode !== "VALID" &&
    parsed.reasonCode !== "NOT_A_PLANT" &&
    parsed.reasonCode !== "WRONG_CROP" &&
    parsed.reasonCode !== "BLURRY_IMAGE"
  ) {
    throw new Error("Groq plan validation returned invalid reasonCode value");
  }
  if (typeof parsed.userGuidance !== "string") {
    throw new Error("Groq plan validation returned invalid userGuidance value");
  }
  if (parsed.isValid && parsed.reasonCode !== "VALID") {
    throw new Error(
      "Groq plan validation returned inconsistent isValid and reasonCode"
    );
  }
  if (!parsed.isValid && parsed.reasonCode === "VALID") {
    throw new Error(
      "Groq plan validation returned inconsistent invalid VALID response"
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
      console.warn(
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
      console.warn(
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
      console.warn(
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
    };
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

  return {
    isValid: false,
    reasonCode: parsed.reasonCode,
    userGuidance: parsed.userGuidance.trim() || fallbackGuidance,
    detectedGrowthStage: null,
    detectedPestDisease: null,
    detectedSeverityLevel: null,
  };
}

export async function validateImagesWithGroq(
  base64Images: string[],
  cropType?: string
): Promise<ImageValidationResponse> {
  const hasApiKey = !!process.env.GROQ_API_KEY_PLAN_VALIDATION;
  console.log(
    `[AI Plan Validation Groq API Key Check] Key exists: ${hasApiKey}`
  );
  if (!hasApiKey) {
    throw new Error(
      "GROQ_API_KEY_PLAN_VALIDATION is not defined in environment variables"
    );
  }

  const cropOption = cropGrowthStageOptions.find((o) => eqStr(o.cropType, cropType));
  const allowedStages = cropOption?.growthStages ?? [];
  const allowedPestDiseases = cropOption?.pestDiseases ?? [];
  const allowedSeverityLevels = cropOption?.severityLevels ?? [];

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: buildImageValidationPrompt(cropType, allowedStages, allowedPestDiseases, allowedSeverityLevels),
    },
  ];

  for (let idx = 0; idx < base64Images.length; idx++) {
    const base64Data = base64Images[idx];
    console.log(
      `[AI Plan Validation Groq Payload] Image ${idx} size: ${((base64Data.length * 0.75) / 1024).toFixed(2)} KB`
    );
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${base64Data}` },
    });
  }

  console.log("[AI Plan Validation API Call] Sending request to Groq API...");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY_PLAN_VALIDATION}`,
    },
    body: JSON.stringify({
      model:
        process.env.GROQ_VISION_MODEL ||
        "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_completion_tokens: 512,
      response_format: { type: "json_object" },
      stream: false,
    }),
  });

  const responseText = await res.text();
  const data = JSON.parse(responseText || "{}");
  if (!res.ok) {
    throw new Error(
      `Groq plan validation API failed with ${res.status}: ${JSON.stringify(data)}`
    );
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Groq plan validation API returned an empty response");
  }

  console.log(
    `[AI Plan Validation Groq Response] Received response. Text length: ${text.length}\nRaw text:`, text
  );
  return parseImageValidationJson(text, cropType, allowedStages, allowedPestDiseases, allowedSeverityLevels);
}

// ─── AI Diagnosis Runners ────────────────────────────────────────────────────

function buildDiagnosisPromptText(cropType?: string) {
  return `Bạn là chuyên gia nông nghiệp của VFC. Hãy phân tích hình ảnh cây trồng của nông dân${cropType ? ` (loại: ${cropType})` : ""} và so sánh với các dữ liệu bệnh tham khảo của VFC để:\n1. Đưa ra chẩn đoán cuối cùng về loại nấm, vi khuẩn hoặc sâu hại gây bệnh, ưu tiên kết quả khớp với dữ liệu VFC nếu triệu chứng tương đồng.\n2. Xác định chi tiết tên bệnh, mức độ bệnh.\n3. Đề xuất hướng xử lý.\n4. Trích xuất CHÍNH XÁC tên các sản phẩm (từ phần Giải pháp VFC / vfcSolution) và phân chia chúng thành các "bộ giải pháp" tương ứng nếu vfcSolution đề xuất nhiều lựa chọn (chữ "hoặc", "luân phiên"). Nếu "Không phun", để rỗng mảng.\n\nTrả về kết quả dưới dạng JSON thuần túy (không có markdown) với format: \n{ \n  "disease": "tên bệnh", \n  "severity": "mức độ bệnh", \n  "summary": "tóm tắt ngắn gọn hướng xử lý", \n  "confidence": 0.9,\n  "vfcSolutionText": "Câu Giải pháp VFC nguyên bản",\n  "solutionSets": [\n    { "name": "Tên bộ giải pháp (ví dụ: Bộ 1, Bộ luân phiên...)", "products": ["tên sản phẩm 1", "tên sản phẩm 2"] }\n  ],\n  "reasons": { "tên sản phẩm 1": "công dụng rõ ràng của sản phẩm đối với tình trạng cây" }\n}`;
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
  console.log(`[AI Diagnosis Gemini API Key Check] Key exists: ${hasApiKey}`);
  if (!hasApiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    generationConfig: { temperature: 0.1 },
  });

  const parts: GeminiContentPart[] = [
    { text: "Ảnh cây trồng của nông dân:" },
  ];
  for (const b64 of userImages) {
    parts.push({ inlineData: { data: b64, mimeType: "image/jpeg" } });
  }
  parts.push({ text: "\n\nDữ liệu bệnh tham khảo của VFC:" });
  for (const ref of referenceData) {
    parts.push({ text: "\n" + ref.text });
    if (ref.base64Image) {
      parts.push({ inlineData: { data: ref.base64Image, mimeType: "image/jpeg" } });
    }
  }
  parts.push({ text: `\n\n${prompt}` });

  console.log("[AI Diagnosis API Call] Sending request to Gemini API...");
  const result = await model.generateContent(parts);
  const text = result.response.text();
  console.log(
    `[AI Diagnosis Gemini Response] Received response. Text length: ${text.length}\nRaw text:`, text
  );
  return parseAiJson(text, "gemini");
}

async function analyzeWithGroq(
  prompt: string,
  userImages: string[],
  referenceData: ReferenceData[]
): Promise<AiDiagnosisResponse> {
  const hasApiKey = !!process.env.GROQ_API_KEY;
  console.log(`[AI Diagnosis Groq API Key Check] Key exists: ${hasApiKey}`);
  if (!hasApiKey) {
    throw new Error("GROQ_API_KEY is not defined in environment variables");
  }

  const content: GroqContentPart[] = [
    { type: "text", text: "Ảnh cây trồng của nông dân:" },
  ];
  for (const b64 of userImages) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${b64}` },
    });
  }
  content.push({ type: "text", text: "\n\nDữ liệu bệnh tham khảo của VFC:" });
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

  console.log("[AI Diagnosis API Call] Sending request to Groq API...");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:
        process.env.GROQ_VISION_MODEL ||
        "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{ role: "user", content }],
      temperature: 0.2,
      max_completion_tokens: 1024,
      response_format: { type: "json_object" },
      stream: false,
    }),
  });

  const responseText = await res.text();
  const data = JSON.parse(responseText || "{}");
  if (!res.ok)
    throw new Error(
      `Groq API failed with ${res.status}: ${JSON.stringify(data)}`
    );

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq API returned an empty response");

  console.log(
    `[AI Diagnosis Groq Response] Received response. Text length: ${text.length}\nRaw text:`, text
  );
  return parseAiJson(text, "groq");
}

async function analyzeWithOpenRouter(
  prompt: string,
  userImages: string[],
  referenceData: ReferenceData[]
): Promise<AiDiagnosisResponse> {
  const hasApiKey = !!process.env.OPENROUTER_API_KEY;
  console.log(`[AI Diagnosis OpenRouter API Key Check] Key exists: ${hasApiKey}`);
  if (!hasApiKey) {
    throw new Error("OPENROUTER_API_KEY is not defined in environment variables");
  }

  const content: GroqContentPart[] = [
    { type: "text", text: "Ảnh cây trồng của nông dân:" },
  ];
  for (const b64 of userImages) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${b64}` },
    });
  }
  content.push({ type: "text", text: "\n\nDữ liệu bệnh tham khảo của VFC:" });
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
  console.log(`[AI Diagnosis API Call] Sending request to OpenRouter (${model})...`);

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
      response_format: { type: "json_object" },
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

  console.log(
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
    console.log("[AI Fallback] Trying Gemini...");
    const parsed = await analyzeWithGemini(prompt, userImages, referenceData);
    console.log(`[AI Fallback] Gemini succeeded | Provider: gemini | Disease: ${parsed.disease} | Products: ${parsed.solutionSets?.length ?? 0} sets`);
    return { ...parsed, aiProvider: "gemini" };
  } catch (geminiError) {
    console.error("[AI Fallback] Gemini failed, trying Groq", geminiError);
  }

  // 2nd: Groq
  try {
    console.log("[AI Fallback] Trying Groq...");
    const parsed = await analyzeWithGroq(prompt, userImages, referenceData);
    console.log(`[AI Fallback] Groq succeeded | Provider: groq | Disease: ${parsed.disease} | Products: ${parsed.solutionSets?.length ?? 0} sets`);
    return { ...parsed, aiProvider: "groq", fallbackFrom: "gemini" };
  } catch (groqError) {
    console.error("[AI Fallback] Groq failed, trying OpenRouter", groqError);
  }

  // 3rd: OpenRouter
  console.log("[AI Fallback] Trying OpenRouter...");
  const parsed = await analyzeWithOpenRouter(prompt, userImages, referenceData);
  console.log(`[AI Fallback] OpenRouter succeeded | Provider: openrouter | Disease: ${parsed.disease} | Products: ${parsed.solutionSets?.length ?? 0} sets`);
  return { ...parsed, aiProvider: "openrouter", fallbackFrom: "groq" };
}

export async function runAiDiagnosis(
  diagnosisId: string,
  base64Images: string[],
  cropType?: string,
  growthStage?: string,
  pestDisease?: string,
  severityLevel?: string
) {
  console.log(
    `[AI Diagnosis Start] ID: ${diagnosisId}, Crop: ${cropType}, Stage: ${growthStage}, Pest: ${pestDisease ?? "any"}, Severity: ${severityLevel ?? "any"}`
  );

  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

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

  console.log(
    `[AI Diagnosis Reference Data] ID: ${diagnosisId}, matched ${relevantDiseases.length} reference records`
  );
  console.log(
    `[AI Diagnosis Filter] ID: ${diagnosisId} | Crop: ${cropType} | Stage: ${growthStage} | Pest: ${pestDisease ?? "any"} | Severity: ${severityLevel ?? "any"} -> ${relevantDiseases.length} records`
  );

  if (relevantDiseases.length > MAX_REFERENCE_ITEMS) {
    console.warn(
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
      const text = `- Bệnh: ${d.detail} (${d.pestDisease})\n- Mức độ: ${d.severityLevel}\n- Mô tả: ${d.description}\n- Giải pháp VFC: ${d.vfcSolution}`;
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
      const product = allProducts.find(
        (p) =>
          includesStr(p.name, pName) ||
          includesStr(pName, p.name)
      );
      if (product && !validProductIds.includes(product.id)) {
        validProductIds.push(product.id);
        reasonsMap[product.id] =
          parsed.reasons?.[pName] ||
          `Phù hợp với triệu chứng: ${parsed.disease}`;
        console.log(`[AI Diagnosis Product Match] ID: ${diagnosisId} | AI name: "${pName}" -> matched product: ${product.id} (${product.name})`);
      } else if (!product) {
        console.warn(`[AI Diagnosis Product NOT Found] ID: ${diagnosisId} | AI name: "${pName}" not found in ${allProducts.length} active products`);
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

    console.log(`[AI Diagnosis Success] ID: ${diagnosisId}`);
  } catch (err) {
    console.error(`[AI Diagnosis Error] ID: ${diagnosisId}`, err);
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
