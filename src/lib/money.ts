const currencyDecimals: Record<string, number> = {
  EUR: 2,
  IDR: 0,
  USD: 2,
};

export function getCurrencyDecimals(currency: string) {
  return currencyDecimals[currency] ?? 2;
}

export function moneyToMinorUnits(amount: string, currency: string) {
  const decimals = getCurrencyDecimals(currency);
  const pattern =
    decimals === 0
      ? /^(?:0|[1-9]\d*)$/
      : /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
  const normalized = amount.trim();

  if (!pattern.test(normalized)) {
    throw new Error(
      decimals === 0
        ? "Enter a whole amount for this currency."
        : "Enter a positive amount with up to two decimal places.",
    );
  }

  const [whole, fraction = ""] = normalized.split(".");
  const scale = 10n ** BigInt(decimals);
  const fractionValue = decimals
    ? BigInt(fraction.padEnd(decimals, "0"))
    : 0n;
  const minorUnits = BigInt(whole) * scale + fractionValue;

  if (minorUnits <= 0n || minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Enter an amount greater than zero and within the supported range.");
  }

  return Number(minorUnits);
}

export function formatMoney(minorUnits: number, currency: string) {
  const decimals = getCurrencyDecimals(currency);
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minorUnits / 10 ** decimals);
}
