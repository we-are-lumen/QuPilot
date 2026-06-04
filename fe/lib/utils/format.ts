/**
 * Helper to format reward amounts in lamports to SOL.
 */
export function formatReward(amount: string | number): string {
  try {
    const num = BigInt(amount);
    if (num === BigInt(0)) return "0 SOL";

    const lamportsPerSol = BigInt("1000000000");
    const whole = num / lamportsPerSol;
    const frac = num % lamportsPerSol;
    const fracStr = frac.toString().padStart(9, "0");
    const frac4 = fracStr.slice(0, 4).replace(/0+$/, "");

    return `${whole.toString()}${frac4 ? `.${frac4}` : ""} SOL`;
  } catch {
    return `${amount} SOL`;
  }
}

/**
 * Parse a SOL amount (e.g. "1", "0.5", "12.345") into lamports (BigInt).
 * - Accepts up to 9 decimals (Solana precision).
 * - Throws on invalid/empty input.
 */
export function parseSolToLamports(input: string | number | bigint): bigint {
  if (typeof input === "bigint") return input;
  const raw = String(input).trim();
  if (!raw) throw new Error("Empty SOL amount");

  // Digits with optional fractional part up to 9 decimals.
  if (!/^\d+(\.\d{0,9})?$/.test(raw)) {
    throw new Error("Invalid SOL amount");
  }

  const [wholeStr, fracStr = ""] = raw.split(".");
  const whole = BigInt(wholeStr || "0");
  const fracPadded = (fracStr + "000000000").slice(0, 9); // right-pad to 9 decimals
  const frac = BigInt(fracPadded || "0");
  return whole * 1000000000n + frac;
}
