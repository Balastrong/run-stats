export function formatDate(value?: string): string {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function roundedNumber(value?: number): string {
  return value !== undefined ? String(Math.round(value)) : "—";
}

export function decimalNumber(value?: number): string {
  return value !== undefined ? value.toFixed(1) : "—";
}

export function withUnit(value: number | undefined, suffix: string): string {
  return value !== undefined ? `${value} ${suffix}` : "—";
}
