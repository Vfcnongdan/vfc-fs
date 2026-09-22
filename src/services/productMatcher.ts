import { normalizeStr, includesStr } from "../lib/utils";

export interface DiagnosisProduct {
  id: string;
  name: string;
}

// Bảng ánh xạ alias / biệt danh / các lỗi chính tả và nồng độ phổ biến
const PRODUCT_ALIASES: Record<string, string> = {
  // Banjo Forte (khắc phục lỗi chính tả Banjo Forrte trong DB)
  "banjo forte": "Banjo Forrte 400SC",
  "banjo forte 400sc": "Banjo Forrte 400SC",
  
  // Lỗi chính tả tên hoạt chất / biệt dược
  "vitako": "Virtako 40WG",
  "vitako 40wg": "Virtako 40WG",
  "michell": "Michelle 62EC",
  "michell 62ec": "Michelle 62EC",
  "karare": "Karate 2.5EC",
  "karare 2.5ec": "Karate 2.5EC",
  "selecon": "Selecron 500EC",
  "selecon 500ec": "Selecron 500EC",
  "selecoron": "Selecron 500EC",
  "ridoml": "Ridomil Gold 68WG",
  "ridomil glold": "Ridomil Gold 68WG",
  "ridomil glold 68wg": "Ridomil Gold 68WG",

  // Lỗi sai nồng độ / hàm lượng / dạng chế phẩm
  "tervigo 020sc": "Tervigo 20SC",
  "combo 500wg": "Combo 600WG",
  "combo 60wg": "Combo 600WG",
  "opal 500wg": "Opal 50WG",
  "revus opti 400sc": "Revus Opti 440SC",
  "selecron 500sc": "Selecron 500EC",
  "solo 250sc": "Solo 350SC",
  
  // Tên viết tắt hoặc kèm vị trí bón
  "vbaci": "Vbaci SP",
  "vbaci duoi re": "Vbaci SP",
  "tora": "Tora 1.1SL",
  "tora tren la": "Tora 1.1SL",
  "delfan": "Delfan Plus",
  "atas": "Atas 500EC",
  "blastogan": "Blastogan 75WP",
  "dual gold": "Dual Gold 960EC",
  "pexena": "Pexena 20WG",
  "nevo": "Nevo 330EC",
};

// Stop words / noise phrases thường lẫn vào khi AI trích xuất
const NOISE_WORDS = [
  /^(bang|phong|phun|tri|xu ly|bo sung)\s+/gi,
  /\s+(duoi re|tren la|duoi goc|qua la|vao goc)$/gi,
];

function cleanAiName(raw: string): string {
  let s = raw.trim();
  for (const re of NOISE_WORDS) {
    s = s.replace(re, "").trim();
  }
  return s;
}

/**
 * Tính khoảng cách Levenshtein giữa 2 chuỗi
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Rút trích tên thương hiệu cốt lõi (Core Brand), bỏ qua các thông số nồng độ/dạng (e.g. 500EC, 40WG...)
 */
function getCoreBrand(name: string): string {
  return normalizeStr(name)
    .replace(/\b\d+(\.\d+)?[a-z%]+\b/gi, "") // bỏ 500EC, 40WG, 325SC...
    .replace(/\b\d+\b/g, "") // bỏ số đơn lẻ nếu có (trừ trường hợp đặc biệt)
    .trim();
}

/**
 * Tìm sản phẩm theo tên AI với multi-layer matching:
 * 1. Exact match / includesStr (nguyên bản)
 * 2. Alias mapping (từ điển alias & lỗi chính tả)
 * 3. Làm sạch từ nhiễu (clean noise words) & thử lại
 * 4. So khớp Core Brand (tên thương hiệu, bỏ qua nồng độ/hàm lượng)
 * 5. Fuzzy match (Levenshtein distance <= 1 hoặc 2 cho từ dài)
 */
export function matchProductAdvanced(
  aiName: string,
  products: DiagnosisProduct[]
): DiagnosisProduct | undefined {
  if (!aiName || !aiName.trim()) return undefined;

  const raw = aiName.trim();
  const norm = normalizeStr(raw);

  // 1. Exact match hoặc includesStr 2 chiều trực tiếp
  const directMatch = products.find(
    (p) => includesStr(p.name, raw) || includesStr(raw, p.name)
  );
  if (directMatch) return directMatch;

  // 2. Tra cứu từ điển Alias
  const aliasTarget = PRODUCT_ALIASES[norm];
  if (aliasTarget) {
    const aliasMatch = products.find(
      (p) => includesStr(p.name, aliasTarget) || includesStr(aliasTarget, p.name)
    );
    if (aliasMatch) return aliasMatch;
  }

  // 3. Làm sạch từ nhiễu và thử tra cứu lại
  const cleaned = cleanAiName(raw);
  if (cleaned !== raw) {
    const cleanedNorm = normalizeStr(cleaned);
    const cleanedDirect = products.find(
      (p) => includesStr(p.name, cleaned) || includesStr(cleaned, p.name)
    );
    if (cleanedDirect) return cleanedDirect;

    const cleanedAlias = PRODUCT_ALIASES[cleanedNorm];
    if (cleanedAlias) {
      const aliasMatch = products.find(
        (p) => includesStr(p.name, cleanedAlias) || includesStr(cleanedAlias, p.name)
      );
      if (aliasMatch) return aliasMatch;
    }
  }

  // 4. So khớp theo Core Brand (bỏ nồng độ, dạng chế phẩm)
  // Ví dụ: "Tervigo 020SC" -> core: "tervigo" == "tervigo 20sc" -> core: "tervigo"
  const candidateCore = getCoreBrand(cleaned);
  if (candidateCore.length >= 3) {
    // Không áp dụng cho chuỗi quá ngắn để tránh nhầm
    const brandMatch = products.find((p) => {
      const pCore = getCoreBrand(p.name);
      return pCore === candidateCore || (pCore.length >= 4 && candidateCore.length >= 4 && (pCore.includes(candidateCore) || candidateCore.includes(pCore)));
    });
    if (brandMatch) return brandMatch;
  }

  // 5. Fuzzy matching qua Levenshtein
  // Kiểm tra tên thương hiệu gần giống nhất
  let bestProduct: DiagnosisProduct | undefined = undefined;
  let minDistance = Infinity;

  for (const p of products) {
    const pNorm = normalizeStr(p.name);
    const pCore = getCoreBrand(p.name);

    // Thử tính khoảng cách giữa candidateCore và pCore
    if (candidateCore.length >= 4 && pCore.length >= 4) {
      const dist = levenshtein(candidateCore, pCore);
      const maxAllowed = Math.max(candidateCore.length, pCore.length) >= 7 ? 2 : 1;
      if (dist <= maxAllowed && dist < minDistance) {
        minDistance = dist;
        bestProduct = p;
      }
    }
  }

  return bestProduct;
}
