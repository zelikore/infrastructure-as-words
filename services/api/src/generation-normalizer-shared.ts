export const defaultModuleReason = "Selected to satisfy the requested AWS platform shape.";
export const defaultFileContent = "# Generated artifact\n";

export const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export const readText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
};

export const readTextFromKeys = (
  record: Record<string, unknown> | undefined,
  keys: readonly string[]
): string | undefined => {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = readText(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
};

export const trimToLength = (value: string, maxLength: number): string =>
  value.trim().slice(0, maxLength).trim();

export const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const titleize = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

export const combineText = (
  primary: string | undefined,
  secondary: string | undefined,
  maxLength: number
): string | undefined => {
  if (primary && secondary) {
    return trimToLength(`${primary}: ${secondary}`, maxLength);
  }

  return primary
    ? trimToLength(primary, maxLength)
    : secondary
      ? trimToLength(secondary, maxLength)
      : undefined;
};
