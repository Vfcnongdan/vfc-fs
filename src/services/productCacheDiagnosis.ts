import { prisma } from "@/lib/prisma";
import { includesStr } from "@/lib/utils";
import { logger } from "@/lib/logger";

/**
 * In-memory cache danh sách sản phẩm active cho AI Diagnosis.
 * Products rất ít thay đổi (~20–50 items), cache giúp giảm 100% DB query
 * trong flow chẩn đoán (mỗi lần nông dân gửi ảnh).
 *
 * Cache được invalidate tự động khi Admin thêm / sửa / xóa sản phẩm.
 */

type DiagnosisProduct = { id: string; name: string };

let cache: DiagnosisProduct[] | null = null;

async function load(): Promise<DiagnosisProduct[]> {
  if (cache) return cache;

  logger.info("[productCacheDiagnosis] Cache miss — querying DB...");
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  cache = products;
  logger.info(
    `[productCacheDiagnosis] Cached ${products.length} active products`
  );
  return cache;
}

/** Lấy danh sách sản phẩm active (from cache) */
export async function getDiagnosisProducts(): Promise<DiagnosisProduct[]> {
  return load();
}

/**
 * Tìm sản phẩm theo tên AI trả về (fuzzy match: includesStr 2 chiều).
 * Trả về product đầu tiên khớp, hoặc undefined.
 */
export async function findProductByAiName(
  aiName: string
): Promise<DiagnosisProduct | undefined> {
  const products = await load();
  return products.find(
    (p) => includesStr(p.name, aiName) || includesStr(aiName, p.name)
  );
}

/** Xóa cache in-memory. Lần gọi tiếp sẽ query lại DB. */
export function invalidateDiagnosisProductsCache() {
  cache = null;
  logger.info("[productCacheDiagnosis] Cache invalidated");
}
