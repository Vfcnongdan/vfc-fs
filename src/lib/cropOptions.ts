import fs from "fs";
import path from "path";
import {
  type CropGrowthStageOptions,
  cropGrowthStageOptions as fallbackOptions,
} from "./deseaseDetails";
import { eqStr } from "./utils";

const FILE_PATH = path.join(process.cwd(), "public", "crop-options.json");

let cache: CropGrowthStageOptions[] | null = null;

function loadOptions(): CropGrowthStageOptions[] {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    cache = JSON.parse(raw) as CropGrowthStageOptions[];
    return cache!;
  } catch {
    // File chưa tồn tại → dùng hard-coded fallback
    return fallbackOptions;
  }
}

/** Xóa cache in-memory, lần đọc tiếp sẽ load lại file từ disk */
export function invalidateCropOptionsCache() {
  cache = null;
}

/** Lấy toàn bộ crop options (đọc từ file, cached in-memory) */
export function getCropOptions(): CropGrowthStageOptions[] {
  return loadOptions();
}

/** Lấy options cho 1 crop cụ thể (case & accent insensitive) */
export function getCropOptionByType(
  cropType?: string | null,
): CropGrowthStageOptions | null {
  if (!cropType) return null;
  return loadOptions().find((o) => eqStr(o.cropType, cropType)) ?? null;
}
