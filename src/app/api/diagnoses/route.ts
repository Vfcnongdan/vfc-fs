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
  const sharp = (await import("sharp")).default;

  for (const file of files) {
    let buffer: Buffer | null = Buffer.from(await file.arrayBuffer());

    // Optimize image: resize to max 256px and compress aggressively
    const optimizedBuffer = await sharp(buffer)
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 40 })
      .toBuffer();

    base64Images.push(optimizedBuffer.toString("base64"));

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

  // Await AI analysis to prevent Vercel from killing the serverless function mid-execution
  try {
    await runAiDiagnosis(diagnosis.id, base64Images, cropType ?? undefined);
  } catch (err) {
    console.error("[POST AI Diagnosis Error]", err);
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
1. Xác định bệnh/vấn đề (nếu có). Cung cấp thông tin chi tiết tên bệnh.
2. Đánh giá mức độ bệnh theo thang của riêng bệnh đó (nếu có), hoặc đánh giá mức độ chung chung (nhẹ/trung bình/nặng).
3. Đề xuất hướng xử lý.
4. CHỌN ra tối đa 3 sản phẩm PHÙ HỢP NHẤT từ danh sách dưới đây dựa trên công dụng của chúng:
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

function parseAiJson(text: string, provider: AiProvider): AiDiagnosisResponse {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`[AI Diagnosis Parse Error] No JSON block found in ${provider} response. Raw text:`, text);
    throw new Error(`${provider} failed to return valid JSON`);
  }

  return JSON.parse(jsonMatch[0]);
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
