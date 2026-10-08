export interface RawDiseaseRecord {
  id: string;
  cropType?: string | null;
  growthStage?: string | null;
  pestDisease?: string | null;
  detail: string;
  severityLevel?: string | null;
  imageUrls?: string[] | null;
  description: string;
  vfcSolution: string;
  [key: string]: any;
}

export interface AggregatedDisease {
  id: string;
  diseaseKey: string;
  detail: string;
  pestDisease?: string | null;
  severityLevel: string;
  description: string;
  vfcSolution: string;
  imageUrls: string[];
  stagesCovered: string[];
}

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const severityRank: Record<string, number> = {
  'trung bình': 4,
  nặng: 3,
  nhẹ: 2,
  'hết cứu': 1,
  'không có': 0,
};

/**
 * Thuật toán Gom nhóm Thực thể Bệnh & Khử trùng lặp Giải pháp VFC cho Monolith Fallback
 */
export function aggregateDiseases(
  records: RawDiseaseRecord[],
  preferredStage?: string,
): AggregatedDisease[] {
  if (!records || records.length === 0) return [];

  const groups = new Map<string, RawDiseaseRecord[]>();

  for (const r of records) {
    const key = normalizeKey(r.detail || r.pestDisease || 'UNKNOWN');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(r);
  }

  const normPreferredStage = preferredStage ? normalizeKey(preferredStage) : null;
  const aggregated: AggregatedDisease[] = [];

  for (const [key, groupRecords] of groups) {
    // 1. Tìm bản ghi đại diện tốt nhất cho triệu chứng
    let bestRecord = groupRecords[0];
    let bestScore = -1;

    for (const r of groupRecords) {
      let score = 0;
      const rStage = r.growthStage ? normalizeKey(r.growthStage) : '';
      if (normPreferredStage && rStage === normPreferredStage) {
        score += 10;
      }
      const sRank = severityRank[(r.severityLevel || '').trim().toLowerCase()] ?? 1;
      score += sRank;

      if (score > bestScore) {
        bestScore = score;
        bestRecord = r;
      }
    }

    // 2. Gom và khử trùng lặp các giải pháp VFC theo mức độ
    const solutionMap = new Map<string, string[]>();
    for (const r of groupRecords) {
      const sol = (r.vfcSolution || '').trim();
      if (!sol) continue;
      const sev = (r.severityLevel || 'Chung').trim();
      if (!solutionMap.has(sol)) {
        solutionMap.set(sol, []);
      }
      const list = solutionMap.get(sol)!;
      if (!list.includes(sev)) {
        list.push(sev);
      }
    }

    let consolidatedSolution = '';
    if (solutionMap.size === 0) {
      consolidatedSolution = bestRecord.vfcSolution || 'Tham khảo ý kiến kỹ sư VFC';
    } else if (solutionMap.size === 1) {
      const [onlySolution] = solutionMap.keys();
      consolidatedSolution = onlySolution;
    } else {
      const parts: string[] = [];
      for (const [sol, severities] of solutionMap) {
        parts.push(`+ Mức ${severities.join('/')}: ${sol}`);
      }
      consolidatedSolution = parts.join('\n  ');
    }

    // 3. Gom toàn bộ ảnh hợp lệ của bệnh này từ mọi bản ghi
    const allImages: string[] = [];
    for (const r of groupRecords) {
      if (r.imageUrls && Array.isArray(r.imageUrls)) {
        for (const url of r.imageUrls) {
          if (typeof url === 'string' && url.trim().length > 0 && !allImages.includes(url.trim())) {
            allImages.push(url.trim());
          }
        }
      }
    }

    // 4. Danh sách các giai đoạn mà bệnh này xuất hiện
    const stages = Array.from(
      new Set(
        groupRecords
          .map((r) => r.growthStage?.trim())
          .filter((s): s is string => !!s && s.length > 0),
      ),
    );

    aggregated.push({
      id: bestRecord.id,
      diseaseKey: key,
      detail: bestRecord.detail,
      pestDisease: bestRecord.pestDisease,
      severityLevel: bestRecord.severityLevel || 'Trung bình',
      description: bestRecord.description,
      vfcSolution: consolidatedSolution,
      imageUrls: allImages,
      stagesCovered: stages,
    });
  }

  // 5. Soft Re-ranking
  if (normPreferredStage) {
    aggregated.sort((a, b) => {
      const aMatches = a.stagesCovered.some((s) => normalizeKey(s) === normPreferredStage);
      const bMatches = b.stagesCovered.some((s) => normalizeKey(s) === normPreferredStage);
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });
  }

  return aggregated;
}
