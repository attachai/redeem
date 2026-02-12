export type RoundingMode = "FLOOR" | "ROUND" | "CEIL";

export function calculatePoints(
  spendAmount: number,
  ruleSpendAmount: number,
  ruleEarnPoints: number,
  rounding: RoundingMode = "FLOOR"
): number {
  const raw = (spendAmount / ruleSpendAmount) * ruleEarnPoints;

  let result: number;
  switch (rounding) {
    case "CEIL":
      result = Math.ceil(raw);
      break;
    case "ROUND":
      result = Math.round(raw);
      break;
    case "FLOOR":
    default:
      result = Math.floor(raw);
      break;
  }

  return Math.max(result, 0);
}

export function normalizeTHPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) {
    return "66" + digits.slice(1);
  }
  return digits;
}
