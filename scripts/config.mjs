export function normalizeBasePath(value = "") {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") return "";

  const normalized = `/${trimmed.replace(/^\/+|\/+$/g, "")}`;

  if (!/^\/[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(normalized) || normalized.includes("..")) {
    throw new Error(
      `NEXT_PUBLIC_BASE_PATH 값이 올바르지 않습니다: ${value}. 예: /alien-index`,
    );
  }

  return normalized;
}

export const configuredBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
