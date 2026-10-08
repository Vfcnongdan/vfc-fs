export interface BaseDiseaseRecord {
  id: string;
  pestDisease?: string | null;
  detail?: string | null;
  severityLevel?: string | null;
  imageUrls?: string[] | null;
  [key: string]: any;
}

/**
 * Thuật toán Diversity Sampling (Lấy mẫu đa dạng hóa)
 * Gom nhóm theo pestDisease và lấy xoay vòng Round-Robin để đảm bảo
 * mọi nhóm bệnh và các mức độ bệnh đều có đại diện trực quan gửi cho AI.
 */
export function selectDiverseImages<T extends BaseDiseaseRecord>(
  records: T[],
  maxImages = 8,
): T[] {
  // Chỉ xét những bản ghi có ít nhất 1 ảnh hợp lệ
  const recordsWithImages = records.filter(
    (r) =>
      r.imageUrls &&
      Array.isArray(r.imageUrls) &&
      r.imageUrls.length > 0 &&
      typeof r.imageUrls[0] === 'string' &&
      r.imageUrls[0].trim().length > 0,
  );

  if (recordsWithImages.length <= maxImages) {
    return recordsWithImages;
  }

  // Bước 1: Gom nhóm theo pestDisease (fallback sang detail nếu thiếu)
  const groupsByPest = new Map<string, T[]>();
  for (const record of recordsWithImages) {
    const pestName = (record.pestDisease || record.detail || 'UNKNOWN')
      .trim()
      .toLowerCase();
    if (!groupsByPest.has(pestName)) {
      groupsByPest.set(pestName, []);
    }
    groupsByPest.get(pestName)!.push(record);
  }

  // Bước 2: Sắp xếp các bản ghi trong từng nhóm để đa dạng hóa severityLevel qua các vòng
  // Ưu tiên các mức độ có triệu chứng điển hình (Trung bình, Nặng) trước để làm ảnh tham chiếu trực quan tốt nhất cho AI
  const severityOrder: Record<string, number> = {
    'trung bình': 0,
    nặng: 1,
    nhẹ: 2,
    'hết cứu': 3,
    'không có': 4,
  };

  for (const [, group] of groupsByPest) {
    group.sort((a, b) => {
      const aSev =
        severityOrder[(a.severityLevel || '').trim().toLowerCase()] ?? 99;
      const bSev =
        severityOrder[(b.severityLevel || '').trim().toLowerCase()] ?? 99;
      return aSev - bSev;
    });
  }

  // Bước 3: Round-Robin Quota Picker - Lấy lần lượt từng nhóm cho đến khi đủ maxImages
  const selected: T[] = [];
  const pestKeys = Array.from(groupsByPest.keys());
  let round = 0;

  while (selected.length < maxImages) {
    let addedInThisRound = false;

    for (const key of pestKeys) {
      if (selected.length >= maxImages) break;

      const group = groupsByPest.get(key)!;
      if (group.length > round) {
        selected.push(group[round]);
        addedInThisRound = true;
      }
    }

    if (!addedInThisRound) break;
    round++;
  }

  return selected;
}

/**
 * Điều phối xử lý song song với giới hạn concurrency cố định
 * Tránh spike CPU (khi chạy sharp) và tránh bị rate-limit HTTP 429 từ máy chủ lưu ảnh.
 */
export async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        results[index] = await fn(items[index], index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}
