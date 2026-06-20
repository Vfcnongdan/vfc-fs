const fs = require('fs');

const file = '/Users/admin/projects/vfc/vfc-farmer-success/src/app/api/diagnoses/route.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Add planStageDesease
code = code.replace(
  'import { DiagnosisStatus } from "@prisma/client";',
  'import { DiagnosisStatus } from "@prisma/client";\nimport { planStageDesease } from "@/lib/deseaseDetails";'
);

// 2. Parse growthStage
code = code.replace(
  'const cropType = formData.get("cropType") as string | null;',
  'const cropType = formData.get("cropType") as string | null;\n  const growthStage = formData.get("growthStage") as string | null;'
);

// 3. Update runAiDiagnosis call
code = code.replace(
  'await runAiDiagnosis(diagnosis.id, base64Images, cropType ?? undefined);',
  'await runAiDiagnosis(diagnosis.id, base64Images, cropType ?? undefined, growthStage ?? undefined);'
);

// 4. Update the types and buildDiagnosisPrompt
const oldPromptStart = code.indexOf('function buildDiagnosisPrompt(');
const oldPromptEnd = code.indexOf('function parseJsonBlock(');
const oldPromptCode = code.slice(oldPromptStart, oldPromptEnd);

const newPromptCode = `type ReferenceData = { text: string; base64Image?: string | null };

async function fetchAndOptimizeImage(url: string): Promise<string | null> {
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

function buildDiagnosisPromptText(cropType?: string) {
  return \`Bạn là chuyên gia nông nghiệp của VFC. Hãy phân tích hình ảnh cây trồng của nông dân\${cropType ? \` (loại: \${cropType})\` : ""} và so sánh với các dữ liệu bệnh tham khảo của VFC để:
1. Đưa ra chẩn đoán cuối cùng về loại nấm, vi khuẩn hoặc sâu hại gây bệnh, ưu tiên kết quả khớp với dữ liệu VFC nếu triệu chứng tương đồng.
2. Xác định chi tiết tên bệnh, mức độ bệnh.
3. Đề xuất hướng xử lý.
4. Trích xuất CHÍNH XÁC tên các sản phẩm (từ phần Giải pháp VFC / vfcSolution) phù hợp với tình trạng này.

Trả về kết quả dưới dạng JSON thuần túy (không có markdown) với format: 
{ 
  "disease": "tên bệnh", 
  "severity": "mức độ bệnh", 
  "summary": "tóm tắt ngắn gọn hướng xử lý", 
  "confidence": 0.9,
  "suggestedProducts": ["tên sản phẩm 1", "tên sản phẩm 2"],
  "reasons": { "tên sản phẩm 1": "công dụng rõ ràng của sản phẩm đối với tình trạng cây" }
}\`;
}

`;

code = code.replace(oldPromptCode, newPromptCode);
code = code.replace('suggestedProductIds?: string[];', 'suggestedProducts?: string[];');

// 5. Update analyzeWithGemini
const oldGeminiStart = code.indexOf('async function analyzeWithGemini(');
const oldGeminiEnd = code.indexOf('async function analyzeWithGroq(');
const oldGeminiCode = code.slice(oldGeminiStart, oldGeminiEnd);

const newGeminiCode = `async function analyzeWithGemini(
  prompt: string,
  userImages: string[],
  referenceData: ReferenceData[]
): Promise<AiDiagnosisResponse> {
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  console.log(\`[AI Diagnosis Gemini API Key Check] Key exists: \${hasApiKey}\`);
  if (!hasApiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    generationConfig: { temperature: 0.1 }
  });

  const parts: GeminiContentPart[] = [{ text: "Ảnh cây trồng của nông dân:" }];
  for (const b64 of userImages) {
    parts.push({ inlineData: { data: b64, mimeType: "image/jpeg" } });
  }

  parts.push({ text: "\\n\\nDữ liệu bệnh tham khảo của VFC:" });
  for (const ref of referenceData) {
    parts.push({ text: "\\n" + ref.text });
    if (ref.base64Image) {
      parts.push({ inlineData: { data: ref.base64Image, mimeType: "image/jpeg" } });
    }
  }

  parts.push({ text: \`\\n\\n\${prompt}\` });

  console.log("[AI Diagnosis API Call] Sending request to Gemini API...");
  const result = await model.generateContent(parts);
  const text = result.response.text();
  console.log(\`[AI Diagnosis Gemini Response] Received response. Text length: \${text.length}\`);
  
  return parseAiJson(text, "gemini");
}

`;
code = code.replace(oldGeminiCode, newGeminiCode);

// 6. Update analyzeWithGroq
const oldGroqStart = code.indexOf('async function analyzeWithGroq(');
const oldGroqEnd = code.indexOf('async function analyzeWithFallback(');
const oldGroqCode = code.slice(oldGroqStart, oldGroqEnd);

const newGroqCode = `async function analyzeWithGroq(
  prompt: string,
  userImages: string[],
  referenceData: ReferenceData[]
): Promise<AiDiagnosisResponse> {
  const hasApiKey = !!process.env.GROQ_API_KEY;
  console.log(\`[AI Diagnosis Groq API Key Check] Key exists: \${hasApiKey}\`);
  if (!hasApiKey) {
    throw new Error("GROQ_API_KEY is not defined in environment variables");
  }

  const content: Array<any> = [{ type: "text", text: "Ảnh cây trồng của nông dân:" }];
  for (const b64 of userImages) {
    content.push({ type: "image_url", image_url: { url: \`data:image/jpeg;base64,\${b64}\` } });
  }

  content.push({ type: "text", text: "\\n\\nDữ liệu bệnh tham khảo của VFC:" });
  for (const ref of referenceData) {
    content.push({ type: "text", text: "\\n" + ref.text });
    if (ref.base64Image) {
      content.push({ type: "image_url", image_url: { url: \`data:image/jpeg;base64,\${ref.base64Image}\` } });
    }
  }

  content.push({ type: "text", text: \`\\n\\n\${prompt}\` });

  console.log("[AI Diagnosis API Call] Sending request to Groq API...");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: \`Bearer \${process.env.GROQ_API_KEY}\`,
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
  if (!res.ok) throw new Error(\`Groq API failed with \${res.status}: \${JSON.stringify(data)}\`);

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq API returned an empty response");

  console.log(\`[AI Diagnosis Groq Response] Received response. Text length: \${text.length}\`);
  return parseAiJson(text, "groq");
}

`;
code = code.replace(oldGroqCode, newGroqCode);

// 7. Update analyzeWithFallback
const oldFallbackStart = code.indexOf('async function analyzeWithFallback(');
const oldFallbackEnd = code.indexOf('async function runAiDiagnosis(');
const oldFallbackCode = code.slice(oldFallbackStart, oldFallbackEnd);

const newFallbackCode = `async function analyzeWithFallback(
  prompt: string,
  userImages: string[],
  referenceData: ReferenceData[]
): Promise<AiDiagnosisResponse> {
  try {
    const parsed = await analyzeWithGemini(prompt, userImages, referenceData);
    return { ...parsed, aiProvider: "gemini" };
  } catch (geminiError) {
    console.error("[AI Diagnosis Gemini Error] Falling back to Groq", geminiError);
  }

  const parsed = await analyzeWithGroq(prompt, userImages, referenceData);
  return { ...parsed, aiProvider: "groq", fallbackFrom: "gemini" };
}

`;
code = code.replace(oldFallbackCode, newFallbackCode);

// 8. Update runAiDiagnosis
const oldRunStart = code.indexOf('async function runAiDiagnosis(');
const oldRunCode = code.slice(oldRunStart);

const newRunCode = `async function runAiDiagnosis(
  diagnosisId: string,
  base64Images: string[],
  cropType?: string,
  growthStage?: string
) {
  console.log(\`[AI Diagnosis Start] ID: \${diagnosisId}, Crop: \${cropType}, Stage: \${growthStage}\`);
  
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true }
  });

  const relevantDiseases = planStageDesease.filter(
    (d) => d.cropType === cropType && d.growthStage === growthStage
  );

  const referenceData: ReferenceData[] = [];
  for (const d of relevantDiseases) {
    let b64 = null;
    if (d.imageUrl) {
      const url = Array.isArray(d.imageUrl) ? d.imageUrl[0] : d.imageUrl;
      b64 = await fetchAndOptimizeImage(url);
    }
    const text = \`- Bệnh: \${d.detail} (\${d.pestDisease})\\n- Mức độ: \${d.severityLevel}\\n- Mô tả: \${d.description}\\n- Giải pháp VFC: \${d.vfcSolution}\`;
    referenceData.push({ text, base64Image: b64 });
  }

  const prompt = buildDiagnosisPromptText(cropType);

  try {
    const parsed = await analyzeWithFallback(prompt, base64Images, referenceData);

    const validProductIds: string[] = [];
    const reasonsMap: Record<string, string> = {};

    for (const pName of parsed.suggestedProducts ?? []) {
      const product = allProducts.find((p) => 
        p.name.toLowerCase().includes(pName.toLowerCase()) || 
        pName.toLowerCase().includes(p.name.toLowerCase())
      );
      if (product && !validProductIds.includes(product.id)) {
        validProductIds.push(product.id);
        reasonsMap[product.id] = parsed.reasons?.[pName] || \`Phù hợp với triệu chứng: \${parsed.disease}\`;
      }
    }

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
    
    console.log(\`[AI Diagnosis Success] ID: \${diagnosisId}\`);
  } catch (err) {
    console.error(\`[AI Diagnosis Error] ID: \${diagnosisId}\`, err);
    await prisma.plantDiagnosis.update({
      where: { id: diagnosisId },
      data: { status: DiagnosisStatus.FAILED },
    });
  }
}
`;

code = code.replace(oldRunCode, newRunCode);

fs.writeFileSync(file, code);
