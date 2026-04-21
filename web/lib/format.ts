export const formatTimestamp = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export const formatUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2
  }).format(value);

export const formatModelLabel = (modelId: string): string =>
  modelId
    .replace(/^us\.anthropic\./, "")
    .replace(/-v\d+$/, "")
    .replace(/^claude-/, "")
    .replace(/-/g, " ");
