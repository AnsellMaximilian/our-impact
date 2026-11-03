export function safeInternalRedirect(
  value: string | null | undefined,
  fallback = "/dashboard",
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    return fallback;
  }

  return value;
}

