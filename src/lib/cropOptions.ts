import { prisma } from "./prisma";
import {
  type CropGrowthStageOptions,
  cropGrowthStageOptions as fallbackOptions,
} from "./deseaseDetails";
import { eqStr } from "./utils";

const CONFIG_KEY = "crop-options";

let cache: CropGrowthStageOptions[] | null = null;

async function loadOptions(): Promise<CropGrowthStageOptions[]> {
  if (cache) return cache;
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY },
    });
    if (config) {
      cache = config.value as CropGrowthStageOptions[];
      return cache;
    }
  } catch (err) {
    console.error("[cropOptions] Failed to load from DB, using fallback:", err);
  }
  // DB chưa có data → dùng hard-coded fallback
  return fallbackOptions;
}

/** Xóa cache in-memory, lần đọc tiếp sẽ query lại DB */
export function invalidateCropOptionsCache() {
  cache = null;
}

/** Lấy toàn bộ crop options (DB-backed, cached in-memory) */
export async function getCropOptions(): Promise<CropGrowthStageOptions[]> {
  return loadOptions();
}

/** Lấy options cho 1 crop cụ thể (case & accent insensitive) */
export async function getCropOptionByType(
  cropType?: string | null,
): Promise<CropGrowthStageOptions | null> {
  if (!cropType) return null;
  const options = await loadOptions();
  return options.find((o) => eqStr(o.cropType, cropType)) ?? null;
}
