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
