const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";

export const siteBasePath =
  configuredBasePath && configuredBasePath !== "/"
    ? `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`
    : "";

export function sitePath(pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteBasePath}${path}`;
}
