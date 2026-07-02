/**
 * Removes accents and normalizes a string for comparison.
 */
export const normalizeStr = (s: string): string => {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
};

/**
 * Compares two strings case-insensitively and accent-insensitively.
 */
export const eqStr = (a?: string | null, b?: string | null): boolean => {
  return normalizeStr(a ?? "") === normalizeStr(b ?? "");
};

/**
 * Checks if a string contains another string case-insensitively and accent-insensitively.
 */
export const includesStr = (container?: string | null, search?: string | null): boolean => {
  return normalizeStr(container ?? "").includes(normalizeStr(search ?? ""));
};
