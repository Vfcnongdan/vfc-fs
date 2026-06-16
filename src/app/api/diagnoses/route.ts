import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { DiagnosisStatus } from "@prisma/client";

export const maxDuration = 60; // Tăng timeout cho Vercel Serverless Function (tối đa 60s cho Hobby)

// POST /api/diagnoses — farmer submits photo for AI diagnosis
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const formData = await request.formData().catch(() => null);
  if (!formData) return apiError("INVALID_FORM_DATA", 400);

  const cropType = formData.get("cropType") as string | null;
  // Handle file uploads (placeholder — real impl: upload to GCS/S3)
  const files = formData.getAll("images") as File[];
  if (!files.length) return apiError("NO_IMAGES", 400);

  const base64Images: string[] = [];
  const base64ImagesSmall: string[] = [];
  const sharp = (await import("sharp")).default;

  for (const file of files) {
    let buffer: Buffer | null = Buffer.from(await file.arrayBuffer());

    // Optimize image: resize to max 512px and compress aggressively
    const optimizedBuffer = await sharp(buffer)
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    base64Images.push(optimizedBuffer.toString("base64"));

    const smallBuffer = await sharp(buffer)
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 40 })
      .toBuffer();
    base64ImagesSmall.push(smallBuffer.toString("base64"));

    // Free up buffer memory
    buffer = null;
  }

  const diagnosis = await prisma.plantDiagnosis.create({
    data: {
      userId: user.id,
      cropType,
      imageUrls: [], // Không lưu ảnh vào hệ thống
      status: DiagnosisStatus.PROCESSING,
    },
  });

  try {
    const validationResult = await validateImagesWithGroq(base64ImagesSmall, cropType ?? undefined);

    if (!validationResult.isValid) {
      await prisma.plantDiagnosis.update({
        where: { id: diagnosis.id },
        data: {
          rawAiResponse: validationResult,
          summary: validationResult.userGuidance,
          status: DiagnosisStatus.DONE,
        },
      });
      console.log(`[AI Diagnosis Validation Failed] ID: ${diagnosis.id}`, validationResult);
      return apiError(validationResult.userGuidance, 400);
    }

    await runAiDiagnosis(diagnosis.id, base64Images, cropType ?? undefined);
  } catch (err) {
    console.error("[POST AI Diagnosis Error]", err);
    await prisma.plantDiagnosis.update({
      where: { id: diagnosis.id },
      data: { status: DiagnosisStatus.FAILED },
    });
  }

  const updatedDiagnosis = await prisma.plantDiagnosis.findUnique({
    where: { id: diagnosis.id },
  });

  return apiOk(updatedDiagnosis || { id: diagnosis.id, status: "PROCESSING" }, 200);
}

// GET /api/diagnoses — farmer sees own diagnoses
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 10;

  const [total, diagnoses] = await Promise.all([
    prisma.plantDiagnosis.count({ where: { userId: user.id } }),
    prisma.plantDiagnosis.findMany({
      where: { userId: user.id },
      include: {
        suggestions: {
          include: {
            product: { select: { id: true, name: true, imageUrls: true, slug: true, price: true } },
          },
          orderBy: { rank: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return apiOk({ data: diagnoses, total, page, limit });
}

// ─── AI Runner ────────────────────────────────────────────────────────────────

type AiProvider = "gemini" | "groq";

type ImageValidationReasonCode = "VALID" | "NOT_A_PLANT" | "WRONG_CROP" | "BLURRY_IMAGE";

type ImageValidationResponse = {
  isValid: boolean;
  reasonCode: ImageValidationReasonCode;
  userGuidance: string;
};

const INVALID_IMAGE_GUIDANCE: Record<Exclude<ImageValidationReasonCode, "VALID">, string> = {
  NOT_A_PLANT: "Hệ thống không nhận diện được cây trồng trong ảnh. Vui lòng chụp rõ phần lá hoặc thân cây bị bệnh.",
  WRONG_CROP: "Ảnh chụp có vẻ không phải là cây trồng. Vui lòng kiểm tra lại loại cây bạn đã chọn.",
  BLURRY_IMAGE: "Ảnh chụp bị mờ hoặc quá xa. Bạn vui lòng đưa camera lại gần vết bệnh trên cây (khoảng 20-30cm), giữ chắc tay và chụp lại nơi có đủ ánh sáng nhé.",
};

type AiDiagnosisResponse = {
  disease?: string;
  severity?: string;
  summary?: string;
  confidence?: number;
  suggestedProductIds?: string[];
  reasons?: Record<string, string>;
  aiProvider?: AiProvider;
  fallbackFrom?: AiProvider;
};

type ProductContextItem = {
  id: string;
  name: string;
  targets: string;
};

type GeminiContentPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: "image/jpeg" } };

function buildDiagnosisPrompt(
  productContext: ProductContextItem[],
  cropType?: string,
) {
  return `Bạn là chuyên gia nông nghiệp của VFC. Hãy phân tích hình ảnh cây trồng${cropType ? ` (loại: ${cropType})` : ""} và:
1. Loại trừ các nguyên nhân sinh lý (thiếu nước, sốc nhiệt ...). Đưa ra chẩn đoán cuối cùng về loại nấm hoặc vi khuẩn gây bệnh kèm theo tỷ lệ phần trăm chính xác.
2. Xác định bệnh/vấn đề (nếu có). Cung cấp thông tin chi tiết tên bệnh, hãy dùng tên bệnh thông dụng nhất của nông dân.
3. Đánh giá mức độ bệnh theo thang của riêng bệnh đó (nếu có), hoặc đánh giá mức độ chung chung (nhẹ/trung bình/nặng).
4. Đề xuất hướng xử lý.
5. CHỌN ra tối đa 3 sản phẩm PHÙ HỢP NHẤT từ danh sách dưới đây dựa trên công dụng của chúng:
${JSON.stringify(productContext)}

Đối với mỗi sản phẩm đề nghị, phải ghi rõ CÔNG DỤNG RÕ RÀNG đối với tình trạng bệnh của cây đang hỏi trong phần "reasons".

Trả về kết quả dưới dạng JSON thuần túy (không có markdown) với format: 
{ 
  "disease": "tên bệnh (kèm thông tin chi tiết)", 
  "severity": "mức độ bệnh (theo thang riêng của bệnh hoặc nhẹ/trung bình/nặng)", 
  "summary": "tóm tắt ngắn gọn hướng xử lý", 
  "confidence": 0-1,
  "suggestedProductIds": ["id_san_pham_1", "id_san_pham_2"],
  "reasons": { "id_san_pham_1": "công dụng rõ ràng của sản phẩm đối với tình trạng cây đang hỏi" }
}`;
}

function parseJsonBlock(text: string, provider: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`[AI Parse Error] No JSON block found in ${provider} response. Raw text:`, text);
    throw new Error(`${provider} failed to return valid JSON`);
  }

  return JSON.parse(jsonMatch[0]);
}

function parseAiJson(text: string, provider: AiProvider): AiDiagnosisResponse {
  return parseJsonBlock(text, provider);
}

function parseImageValidationJson(text: string, cropType?: string): ImageValidationResponse {
  const parsed = parseJsonBlock(text, "groq-plan-validation") as Partial<ImageValidationResponse>;

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
    throw new Error("Groq plan validation returned inconsistent isValid and reasonCode");
  }

  if (!parsed.isValid && parsed.reasonCode === "VALID") {
    throw new Error("Groq plan validation returned inconsistent invalid VALID response");
  }

  if (parsed.isValid) {
    return {
      isValid: true,
      reasonCode: "VALID",
      userGuidance: "",
    };
  }

  const fallbackGuidance =
    parsed.reasonCode === "WRONG_CROP"
      ? INVALID_IMAGE_GUIDANCE.WRONG_CROP.replace("cây trồng", cropType || "cây trồng")
      : parsed.reasonCode === "NOT_A_PLANT"
        ? INVALID_IMAGE_GUIDANCE.NOT_A_PLANT
        : INVALID_IMAGE_GUIDANCE.BLURRY_IMAGE;

  return {
    isValid: false,
    reasonCode: parsed.reasonCode,
    userGuidance: parsed.userGuidance.trim() || fallbackGuidance,
  };
}

function buildImageValidationPrompt(cropType?: string) {
  return `Bạn là một bộ lọc bảo mật và kiểm định chất lượng hình ảnh đầu vào cho ứng dụng nông nghiệp. Người dùng sẽ tải lên một bức ảnh và cho biết họ đang muốn kiểm tra cây gì (Tham số: target_crop: ${cropType || "không có thông tin"}).
Hãy phân tích bức ảnh về mặt chi tiết vết bệnh và trả về một đối tượng JSON duy nhất theo cấu trúc nghiêm ngặt sau:
{
  "isValid": true hoặc false,
  "reasonCode": "VALID" | "NOT_A_PLANT" | "WRONG_CROP" | "BLURRY_IMAGE",
  "userGuidance": "Chuỗi tiếng Việt hướng dẫn nông dân chụp lại nếu isValid là false, hoặc chuỗi trống nếu true"
}

Nếu ảnh không chứa cây trồng, bộ phận của cây (lá, thân, rễ): isValid = false, reasonCode = "NOT_A_PLANT", userGuidance = "Hệ thống không nhận diện được cây trồng trong ảnh. Vui lòng chụp rõ phần lá hoặc thân cây bị bệnh."
Nếu ảnh là cây khác hoàn toàn so với target_crop (Ví dụ: người dùng chọn kiểm tra Cây Lúa nhưng chụp ảnh Cây Cà Phê): isValid = false, reasonCode = "WRONG_CROP", userGuidance = "Ảnh chụp có vẻ không phải là ${cropType || "cây trồng"}. Vui lòng kiểm tra lại loại cây bạn đã chọn."
Nếu ảnh quá mờ, quá tối, quá sáng, chụp quá xa hoặc có dấu hiệu không nhìn rõ chi tiết vết bệnh: isValid = false, reasonCode = "BLURRY_IMAGE", userGuidance = "Ảnh chụp không rõ chi tiết vết bệnh. Bạn vui lòng đưa camera lại gần vết bệnh trên cây (khoảng 20-30cm), giữ chắc tay và chụp lại rõ vết bệnh nhé."
Nếu ảnh hợp lệ và phù hợp với target_crop: isValid = true, reasonCode = "VALID", userGuidance = ""`;
}

async function validateImagesWithGroq(
  base64Images: string[],
  cropType?: string,
): Promise<ImageValidationResponse> {
  const hasApiKey = !!process.env.GROQ_API_KEY_PLAN_VALIDATION;
  console.log(`[AI Plan Validation Groq API Key Check] Key exists: ${hasApiKey}`);
  if (!hasApiKey) {
    throw new Error("GROQ_API_KEY_PLAN_VALIDATION is not defined in environment variables");
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: buildImageValidationPrompt(cropType) }];

  for (let idx = 0; idx < base64Images.length; idx++) {
    const base64Data = base64Images[idx];
    console.log(`[AI Plan Validation Groq Payload] Image ${idx} size: ${(base64Data.length * 0.75 / 1024).toFixed(2)} KB`);
    content.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${base64Data}`,
      },
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
      model: process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
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
    throw new Error(`Groq plan validation API failed with ${res.status}: ${JSON.stringify(data)}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Groq plan validation API returned an empty response");
  }

  console.log(`[AI Plan Validation Groq Response] Received response. Text length: ${text.length}`);
  return parseImageValidationJson(text, cropType);
}

async function analyzeWithGemini(
  prompt: string,
  base64Images: string[],
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
    generationConfig: {
      temperature: 0.1
    }
  });

  const parts: GeminiContentPart[] = [{ text: prompt }];

  for (let idx = 0; idx < base64Images.length; idx++) {
    const base64Data = base64Images[idx];
    console.log(`[AI Diagnosis Gemini Payload] Image ${idx} size: ${(base64Data.length * 0.75 / 1024).toFixed(2)} KB`);
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    });
  }

  console.log("[AI Diagnosis API Call] Sending request to Gemini API...");
  const result = await model.generateContent(parts);
  const text = result.response.text();
  console.log(`[AI Diagnosis Gemini Response] Received response. Text length: ${text.length}`);
  parts.length = 0;

  return parseAiJson(text, "gemini");
}

async function analyzeWithGroq(
  prompt: string,
  base64Images: string[],
): Promise<AiDiagnosisResponse> {
  const hasApiKey = !!process.env.GROQ_API_KEY;
  console.log(`[AI Diagnosis Groq API Key Check] Key exists: ${hasApiKey}`);
  if (!hasApiKey) {
    throw new Error("GROQ_API_KEY is not defined in environment variables");
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: prompt }];

  for (let idx = 0; idx < base64Images.length; idx++) {
    const base64Data = base64Images[idx];
    console.log(`[AI Diagnosis Groq Payload] Image ${idx} size: ${(base64Data.length * 0.75 / 1024).toFixed(2)} KB`);
    content.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${base64Data}`,
      },
    });
  }

  console.log("[AI Diagnosis API Call] Sending request to Groq API...");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{ role: "user", content }],
      temperature: 0.2,
      max_completion_tokens: 1024,
      response_format: { type: "json_object" },
      stream: false,
    }),
  });

  const responseText = await res.text();
  const data = JSON.parse(responseText || "{}");
  if (!res.ok) {
    throw new Error(`Groq API failed with ${res.status}: ${JSON.stringify(data)}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Groq API returned an empty response");
  }

  console.log(`[AI Diagnosis Groq Response] Received response. Text length: ${text.length}`);
  return parseAiJson(text, "groq");
}

async function analyzeWithFallback(
  prompt: string,
  base64Images: string[],
): Promise<AiDiagnosisResponse> {
  try {
    const parsed = await analyzeWithGemini(prompt, base64Images);
    return { ...parsed, aiProvider: "gemini" };
  } catch (geminiError) {
    console.error("[AI Diagnosis Gemini Error] Falling back to Groq", geminiError);
  }

  const parsed = await analyzeWithGroq(prompt, base64Images);
  return { ...parsed, aiProvider: "groq", fallbackFrom: "gemini" };
}

async function runAiDiagnosis(
  diagnosisId: string,
  base64Images: string[],
  cropType?: string,
) {
  console.log(`[AI Diagnosis Start] ID: ${diagnosisId}, Crop: ${cropType || "N/A"}, Images count: ${base64Images.length}`);
  
  // 1. Fetch all available products and their targets for AI context
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { detail: true },
  });

  const productContext = allProducts.map((p) => ({
    id: p.id,
    name: p.name,
    targets: p.detail?.targetDiseases || "",
  }));

  console.log(`[AI Diagnosis Context] Products count: ${productContext.length}`);

  const prompt = buildDiagnosisPrompt(productContext, cropType);

  try {
    const parsed = await analyzeWithFallback(prompt, base64Images);

    const suggestedProductIds: string[] = parsed.suggestedProductIds ?? [];
    
    // Lọc chỉ giữ lại những ID thực sự tồn tại trong Database của Server để tránh lỗi Foreign Key
    const validProductIds = suggestedProductIds.filter((pid: string) => 
      allProducts.some((p) => p.id === pid)
    );

    console.log(`[AI Diagnosis DB Update] Updating DB for ${diagnosisId}. Status: DONE, suggested products: ${validProductIds.join(", ")}`);

    await prisma.plantDiagnosis.update({
      where: { id: diagnosisId },
      data: {
        rawAiResponse: parsed,
        summary: parsed.summary,
        confidence: parsed.confidence,
        status: DiagnosisStatus.DONE,
        suggestions: {
          create: validProductIds.map((pid: string, i: number) => ({
            productId: pid,
            reason:
              parsed.reasons?.[pid] ||
              `Phù hợp với triệu chứng: ${parsed.disease}`,
            rank: i + 1,
          })),
        },
      },
    });
    
    console.log(`[AI Diagnosis Success] ID: ${diagnosisId}`, parsed);
  } catch (err) {
    console.error(`[AI Diagnosis Error] ID: ${diagnosisId}`, err);
    await prisma.plantDiagnosis.update({
      where: { id: diagnosisId },
      data: { status: DiagnosisStatus.FAILED },
    });
  }
}
