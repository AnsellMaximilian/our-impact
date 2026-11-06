export function formatEntitlementProgress(value: number, unit: string, locale = "en-US") {
  if (unit.toLowerCase() === "events") {
    return `${value} ${value === 1 ? "event" : "events"}`;
  }

  if (/^[a-z]{3}$/i.test(unit)) {
    const currency = unit.toUpperCase();
    try {
      const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
      const decimals = formatter.resolvedOptions().maximumFractionDigits ?? 2;
      return formatter.format(value / 10 ** decimals);
    } catch {
      // Fall through for an unknown ISO-like unit.
    }
  }

  return `${value} ${unit}`;
}
